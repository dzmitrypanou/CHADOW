<?php

require_once __DIR__ . '/online_server_names.php';

class OnlineHealth
{
    public const GOOD = 'good';
    public const DIP = 'dip';
    public const ISSUE = 'issue';
    public const DOWN = 'down';

    public const HISTORY_HOURS = 24;
    public const BUCKET_SECONDS = 900;
    public const DISPLAY_BUCKET_SECONDS = 1800;
    public const BASELINE_SAMPLES = 40;
    public const DIP_RATIO = 0.75;
    public const ISSUE_RATIO = 0.5;

    private const STATE_WEIGHT = [
        self::GOOD => 0,
        self::DIP => 1,
        self::ISSUE => 2,
        self::DOWN => 3,
    ];

    public static function worstState(string $current, string $incoming): string
    {
        $current = self::normalizeState($current);
        $incoming = self::normalizeState($incoming);

        return (self::STATE_WEIGHT[$incoming] ?? 0) > (self::STATE_WEIGHT[$current] ?? 0)
            ? $incoming
            : $current;
    }

    public static function normalizeState(string $state): string
    {
        $state = strtolower(trim($state));
        if (isset(self::STATE_WEIGHT[$state])) {
            return $state;
        }

        return self::GOOD;
    }

    public static function medianBaseline(array $values): ?int
    {
        $values = array_values(array_filter($values, static fn($value) => $value > 0));
        $count = count($values);
        if ($count === 0) {
            return null;
        }

        sort($values);
        $middle = (int) floor($count / 2);
        if ($count % 2 === 1) {
            return (int) $values[$middle];
        }

        return (int) round(($values[$middle - 1] + $values[$middle]) / 2);
    }

    public static function classifyServer(
        int $online,
        ?int $baseline,
        bool $presentInFreshFetch,
        bool $realmFresh
    ): string {
        if (!$realmFresh) {
            return $online > 0 ? self::GOOD : self::DOWN;
        }
        if (!$presentInFreshFetch) {
            return self::DOWN;
        }
        if ($online <= 0) {
            return self::DOWN;
        }
        if ($baseline === null || $baseline <= 0) {
            return self::GOOD;
        }

        $ratio = $online / $baseline;
        if ($ratio < self::ISSUE_RATIO) {
            return self::ISSUE;
        }
        if ($ratio < self::DIP_RATIO) {
            return self::DIP;
        }

        return self::GOOD;
    }

    public static function classifyRealmApi(bool $realmFresh, bool $hasData): string
    {
        if ($hasData) {
            return self::GOOD;
        }

        return self::DOWN;
    }

    public static function toMajority(string $health): string
    {
        switch (self::normalizeState($health)) {
            case self::ISSUE:
                return 'major';
            case self::DIP:
                return 'minor';
            default:
                return '';
        }
    }

    public static function toStatus(string $health): string
    {
        return self::normalizeState($health) === self::DOWN ? 'offline' : 'online';
    }

    public static function toRecommendation(string $health): string
    {
        switch (self::normalizeState($health)) {
            case self::GOOD:
                return 'recommended';
            case self::DIP:
                return 'available';
            case self::ISSUE:
                return 'not_recommended';
            default:
                return 'not_available';
        }
    }

    public static function appendSample(array $uptime, array $mergedData, array $freshRealms): array
    {
        $timestamp = (int) round(microtime(true) * 1000);
        $bucketTs = self::bucketTimestamp($timestamp);
        $cutoff = $timestamp - (self::HISTORY_HOURS * 3600 * 1000);

        $clusters = is_array($mergedData['clusters'] ?? null) ? $mergedData['clusters'] : [];
        foreach ($clusters as $cluster) {
            if (!is_array($cluster)) {
                continue;
            }

            $realm = (string) ($cluster['flag'] ?? '');
            if ($realm === '') {
                continue;
            }

            if (!isset($uptime[$realm]) || !is_array($uptime[$realm])) {
                $uptime[$realm] = [];
            }

            $realmFresh = !empty($freshRealms[$realm]);
            $freshServerCodes = $realmFresh ? self::freshServerCodes($cluster, $freshRealms, $realm) : [];
            $apiState = self::classifyRealmApi($realmFresh, !empty($cluster['servers']));
            $uptime[$realm]['_api'] = self::appendEntitySample(
                is_array($uptime[$realm]['_api'] ?? null) ? $uptime[$realm]['_api'] : [],
                $bucketTs,
                $apiState,
                $cutoff,
                null
            );

            foreach (is_array($cluster['servers'] ?? null) ? $cluster['servers'] : [] as $server) {
                if (!is_array($server)) {
                    continue;
                }

                $code = OnlineServerNames::canonicalId($realm, (string) ($server['code'] ?? ''));
                if ($code === '') {
                    continue;
                }

                $online = (int) ($server['online'] ?? 0);
                $entity = is_array($uptime[$realm][$code] ?? null) ? $uptime[$realm][$code] : [];
                $recentOnline = self::extractRecentOnline($entity);
                $baseline = self::medianBaseline($recentOnline);
                $presentInFreshFetch = $realmFresh && isset($freshServerCodes[$code]);
                $state = self::classifyServer($online, $baseline, $presentInFreshFetch, $realmFresh);

                $uptime[$realm][$code] = self::appendEntitySample(
                    $entity,
                    $bucketTs,
                    $state,
                    $cutoff,
                    $online
                );
            }
        }

        return self::pruneUptime($uptime, $cutoff);
    }

    private static function freshServerCodes(array $cluster, array $freshRealms, string $realm): array
    {
        if (empty($freshRealms[$realm])) {
            return [];
        }

        $codes = [];
        foreach (is_array($cluster['servers'] ?? null) ? $cluster['servers'] : [] as $server) {
            if (!is_array($server)) {
                continue;
            }
            $code = OnlineServerNames::canonicalId($realm, (string) ($server['code'] ?? ''));
            if ($code !== '') {
                $codes[$code] = true;
            }
        }

        return $codes;
    }

    private static function extractRecentOnline(array $entity): array
    {
        $recent = [];
        foreach (is_array($entity['recent'] ?? null) ? $entity['recent'] : [] as $point) {
            if (!is_array($point) || count($point) < 2) {
                continue;
            }
            $recent[] = (int) $point[1];
        }

        return $recent;
    }

    private static function appendEntitySample(
        array $entity,
        int $bucketTs,
        string $state,
        int $cutoff,
        ?int $online
    ): array {
        $buckets = is_array($entity['buckets'] ?? null) ? $entity['buckets'] : [];
        $updated = false;
        foreach ($buckets as $index => $bucket) {
            if (!is_array($bucket) || count($bucket) < 2) {
                continue;
            }
            if ((int) $bucket[0] === $bucketTs) {
                $buckets[$index] = [$bucketTs, self::worstState((string) $bucket[1], $state)];
                $updated = true;
                break;
            }
        }
        if (!$updated) {
            $buckets[] = [$bucketTs, $state];
        }

        usort($buckets, static fn($a, $b) => ((int) ($a[0] ?? 0)) <=> ((int) ($b[0] ?? 0)));
        $buckets = array_values(array_filter($buckets, static fn($bucket) => is_array($bucket) && (int) ($bucket[0] ?? 0) >= $cutoff));

        $recent = is_array($entity['recent'] ?? null) ? $entity['recent'] : [];
        if ($online !== null) {
            $recent[] = [$bucketTs, $online];
            if (count($recent) > self::BASELINE_SAMPLES) {
                $recent = array_slice($recent, -self::BASELINE_SAMPLES);
            }
        }

        return [
            'recent' => $recent,
            'buckets' => $buckets,
        ];
    }

    private static function bucketTimestamp(int $timestampMs): int
    {
        $bucketMs = self::BUCKET_SECONDS * 1000;

        return (int) (floor($timestampMs / $bucketMs) * $bucketMs);
    }

    public static function pruneUptime(array $uptime, int $cutoff): array
    {
        $pruned = [];
        foreach ($uptime as $realm => $realmData) {
            if (!is_string($realm) || !is_array($realmData)) {
                continue;
            }

            $prunedRealm = [];
            foreach ($realmData as $key => $entity) {
                if (!is_array($entity)) {
                    continue;
                }

                $buckets = array_values(array_filter(
                    is_array($entity['buckets'] ?? null) ? $entity['buckets'] : [],
                    static fn($bucket) => is_array($bucket) && (int) ($bucket[0] ?? 0) >= $cutoff
                ));
                $recent = array_values(array_filter(
                    is_array($entity['recent'] ?? null) ? $entity['recent'] : [],
                    static fn($point) => is_array($point) && (int) ($point[0] ?? 0) >= $cutoff
                ));

                if ($buckets === [] && $recent === []) {
                    continue;
                }

                $prunedRealm[$key] = [
                    'buckets' => $buckets,
                    'recent' => $recent,
                ];
            }

            if ($prunedRealm !== []) {
                $pruned[$realm] = $prunedRealm;
            }
        }

        return $pruned;
    }

    public static function fillTimelineBuckets(array $buckets, ?string $currentState = null): array
    {
        $timestamp = (int) round(microtime(true) * 1000);
        $cutoff = $timestamp - (self::HISTORY_HOURS * 3600 * 1000);
        $displayBucketMs = self::DISPLAY_BUCKET_SECONDS * 1000;
        $storageBucketMs = self::BUCKET_SECONDS * 1000;
        $currentBucket = (int) (floor($timestamp / $displayBucketMs) * $displayBucketMs);
        $startBucket = (int) (floor($cutoff / $displayBucketMs) * $displayBucketMs);

        $rawByTs = [];
        foreach ($buckets as $bucket) {
            if (!is_array($bucket) || count($bucket) < 2) {
                continue;
            }
            $ts = (int) $bucket[0];
            $rawByTs[$ts] = self::normalizeState((string) $bucket[1]);
        }

        $filled = [];
        for ($ts = $startBucket; $ts <= $currentBucket; $ts += $displayBucketMs) {
            $state = null;
            $windowEnd = $ts + $displayBucketMs;
            foreach ($rawByTs as $rawTs => $rawState) {
                if ($rawTs >= $ts && $rawTs < $windowEnd) {
                    $state = $state === null
                        ? $rawState
                        : self::worstState($state, $rawState);
                    continue;
                }
                if ($rawTs >= $ts - $storageBucketMs && $rawTs < $ts) {
                    $state = $state === null
                        ? $rawState
                        : self::worstState($state, $rawState);
                }
            }

            $filled[] = [$ts, $state ?? self::DOWN];
        }

        if ($filled !== []) {
            $lastIndex = count($filled) - 1;
            if ($rawByTs !== []) {
                $latestTs = max(array_keys($rawByTs));
                $filled[$lastIndex][1] = self::worstState(
                    (string) $filled[$lastIndex][1],
                    $rawByTs[$latestTs]
                );
            }
            if ($currentState !== null && $currentState !== '') {
                $filled[$lastIndex][1] = self::normalizeState($currentState);
            }
        }

        return $filled;
    }

    public static function exportTimeline(array $uptime): array
    {
        $export = [];
        foreach ($uptime as $realm => $realmData) {
            if (!is_string($realm) || !is_array($realmData)) {
                continue;
            }

            $export[$realm] = [];
            foreach ($realmData as $key => $entity) {
                if (!is_array($entity)) {
                    continue;
                }
                $export[$realm][$key] = is_array($entity['buckets'] ?? null) ? $entity['buckets'] : [];
            }
        }

        return $export;
    }

    public static function currentState(array $uptime, string $realm, string $serverCode): string
    {
        $entity = $uptime[$realm][$serverCode] ?? null;
        if (!is_array($entity)) {
            return self::GOOD;
        }

        $buckets = is_array($entity['buckets'] ?? null) ? $entity['buckets'] : [];
        if ($buckets === []) {
            return self::GOOD;
        }

        $last = $buckets[count($buckets) - 1];

        return self::normalizeState((string) ($last[1] ?? self::GOOD));
    }

    public static function enrichData(array $data, array $uptime): array
    {
        if (!is_array($data['clusters'] ?? null)) {
            return $data;
        }

        foreach ($data['clusters'] as $index => $cluster) {
            if (!is_array($cluster)) {
                continue;
            }

            $realm = (string) ($cluster['flag'] ?? '');
            if ($realm === '') {
                continue;
            }

            $servers = is_array($cluster['servers'] ?? null) ? $cluster['servers'] : [];
            foreach ($servers as $serverIndex => $server) {
                if (!is_array($server)) {
                    continue;
                }

                $code = OnlineServerNames::canonicalId($realm, (string) ($server['code'] ?? ''));
                $health = self::currentState($uptime, $realm, $code);
                $servers[$serverIndex]['health'] = $health;
                $servers[$serverIndex]['majority'] = self::toMajority($health);
                $servers[$serverIndex]['status'] = self::toStatus($health);
                $servers[$serverIndex]['recommendation'] = self::toRecommendation($health);
            }

            $data['clusters'][$index]['servers'] = $servers;
        }

        return $data;
    }
}
