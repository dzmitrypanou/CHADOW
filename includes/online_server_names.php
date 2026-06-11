<?php

require_once __DIR__ . '/tanki_client.php';

class OnlineServerNames
{
    /**
     * @return array<string, array<string, string>>
     */
    private static function canonicalIds(): array
    {
        return [
            TankiClient::REALM_EU => [
                '203' => 'EU3',
                '204' => 'EU4',
                '205' => 'EU5',
                '206' => 'EU6',
            ],
            TankiClient::REALM_NA => [
                '303' => 'USC',
                '304' => 'SA',
            ],
            TankiClient::REALM_ASIA => [
                '501' => 'ASIA',
                '502' => 'ASIA2',
            ],
            TankiClient::REALM_RU => [],
        ];
    }

    /**
     * @return array<string, array<string, array{ru:string,en:string}>>
     */
    private static function locationLabels(): array
    {
        return [
            TankiClient::REALM_RU => [
                'RU1' => ['ru' => 'RU1 — Москва', 'en' => 'RU1 — Moscow'],
                'RU2' => ['ru' => 'RU2 — Москва', 'en' => 'RU2 — Moscow'],
                'RU3' => ['ru' => 'RU3 — Франкфурт', 'en' => 'RU3 — Frankfurt'],
                'RU4' => ['ru' => 'RU4 — Екатеринбург', 'en' => 'RU4 — Yekaterinburg'],
                'RU5' => ['ru' => 'RU5 — Москва', 'en' => 'RU5 — Moscow'],
                'RU6' => ['ru' => 'RU6 — Москва', 'en' => 'RU6 — Moscow'],
                'RU7' => ['ru' => 'RU7 — Санкт-Петербург', 'en' => 'RU7 — Saint Petersburg'],
                'RU8' => ['ru' => 'RU8 — Красноярск', 'en' => 'RU8 — Krasnoyarsk'],
                'RU9' => ['ru' => 'RU9 — Хабаровск', 'en' => 'RU9 — Khabarovsk'],
                'RU10' => ['ru' => 'RU10 — Павлодар', 'en' => 'RU10 — Pavlodar'],
                'RU11' => ['ru' => 'RU11 — Ташкент', 'en' => 'RU11 — Tashkent'],
                'RU12' => ['ru' => 'RU12 — Москва', 'en' => 'RU12 — Moscow'],
            ],
            TankiClient::REALM_EU => [
                'EU1' => ['ru' => 'EU1 — Амстердам', 'en' => 'EU1 — Amsterdam'],
                'EU2' => ['ru' => 'EU2 — Люксембург', 'en' => 'EU2 — Luxembourg'],
                'EU3' => ['ru' => 'EU3 — Люксембург', 'en' => 'EU3 — Luxembourg'],
                'EU4' => ['ru' => 'EU4 — Алматы', 'en' => 'EU4 — Almaty'],
                'EU5' => ['ru' => 'EU5 — Европа', 'en' => 'EU5 — Europe'],
                'EU6' => ['ru' => 'EU6 — Европа', 'en' => 'EU6 — Europe'],
            ],
            TankiClient::REALM_NA => [
                'USC' => ['ru' => 'US Central — Чикаго', 'en' => 'US Central — Chicago'],
                'SA' => ['ru' => 'South America — Сан-Паулу', 'en' => 'South America — São Paulo'],
                'NA' => ['ru' => 'North America', 'en' => 'North America'],
            ],
            TankiClient::REALM_ASIA => [
                'ASIA' => ['ru' => 'ASIA — Сингапур', 'en' => 'ASIA — Singapore'],
                'ASIA2' => ['ru' => 'ASIA 2', 'en' => 'ASIA 2'],
                'SG' => ['ru' => 'ASIA — Сингапур', 'en' => 'ASIA — Singapore'],
            ],
        ];
    }

    public static function canonicalId(string $realm, string $serverId): string
    {
        $realm = TankiClient::normalizeRealm($realm);
        $serverId = trim($serverId);
        if ($serverId === '') {
            return '';
        }

        $key = strtoupper($serverId);
        $aliases = self::canonicalIds()[$realm] ?? [];

        return $aliases[$serverId] ?? $aliases[$key] ?? $key;
    }

    public static function label(string $realm, string $serverId, string $lang = 'ru'): string
    {
        $realm = TankiClient::normalizeRealm($realm);
        $serverId = trim($serverId);
        if ($serverId === '') {
            return '';
        }

        $canonical = self::canonicalId($realm, $serverId);
        $labels = self::locationLabels()[$realm][$canonical] ?? null;
        if (is_array($labels)) {
            return $labels[$lang === 'en' ? 'en' : 'ru'] ?? $labels['ru'];
        }

        if (preg_match('/^(RU|EU|NA|ASIA|USC|SA)\d*$/i', $canonical)) {
            return strtoupper($canonical);
        }

        return $serverId;
    }

    /**
     * @return array<string, array<string, string>>
     */
    public static function exportMap(string $lang = 'ru'): array
    {
        $lang = $lang === 'en' ? 'en' : 'ru';
        $export = [];

        foreach (TankiClient::supportedRealms() as $realm) {
            $export[$realm] = [];
            $locations = self::locationLabels()[$realm] ?? [];
            foreach ($locations as $code => $labels) {
                $export[$realm][$code] = $labels[$lang] ?? $labels['ru'];
            }

            $aliases = self::canonicalIds()[$realm] ?? [];
            foreach ($aliases as $raw => $canonical) {
                $export[$realm][$raw] = self::label($realm, (string) $raw, $lang);
                $export[$realm][strtoupper((string) $raw)] = $export[$realm][$raw];
            }
        }

        return $export;
    }
}
