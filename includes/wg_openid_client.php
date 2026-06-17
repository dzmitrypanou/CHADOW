<?php

require_once __DIR__ . '/../config/ensure_site_settings.php';

class WgOpenIdClient
{
    private $db;

    public function __construct($db)
    {
        $this->db = $db;
    }

    public static function normalizeRealm(?string $realm): string
    {
        $realm = strtolower(trim((string) $realm));
        return in_array($realm, ['ru', 'eu', 'na'], true) ? $realm : 'eu';
    }

    public static function apiBaseForRealm(string $realm): string
    {
        switch (self::normalizeRealm($realm)) {
            case 'eu':
                return 'https://api.worldoftanks.eu';
            case 'na':
                return 'https://api.worldoftanks.com';
            case 'ru':
                return 'https://api.tanki.su';
            default:
                return 'https://api.worldoftanks.eu';
        }
    }

    public function applicationId(): string
    {
        require_once __DIR__ . '/game_api.php';

        return game_api_wg_application_id($this->db);
    }

    public function applicationIdForRealm(string $realm): string
    {
        require_once __DIR__ . '/game_api.php';

        return game_api_application_id_for_realm($realm, $this->db);
    }

    public function redirectUri(): string
    {
        return user_absolute_url('/auth/wg/callback');
    }

    public function fetchLoginLocation(string $realm, int $expiresAt = 300): array
    {
        $realm = self::normalizeRealm($realm);
        $appId = $this->applicationIdForRealm($realm);
        if ($appId === '') {
            if (!function_exists('game_api_ru_api_label')) {
                require_once __DIR__ . '/game_api.php';
            }

            return ['ok' => false, 'error' => $realm === 'ru'
                ? (game_api_ru_api_label('ru') . ' application_id не настроен')
                : 'WG application_id не настроен'];
        }

        $apiBase = self::apiBaseForRealm($realm);
        $url = $apiBase . '/wot/auth/login/';
        $postFields = http_build_query([
            'application_id' => $appId,
            'redirect_uri' => $this->redirectUri(),
            'nofollow' => 1,
            'expires_at' => $expiresAt,
        ]);

        $response = $this->httpPost($url, $postFields);
        if (!$response['ok']) {
            return ['ok' => false, 'error' => $response['error'] ?? 'Ошибка запроса к WG API'];
        }

        $data = $response['data'];
        if (!is_array($data) || ($data['status'] ?? '') !== 'ok') {
            $err = is_array($data) ? (string) ($data['error']['message'] ?? $data['status'] ?? 'unknown') : 'invalid response';
            return ['ok' => false, 'error' => $err];
        }

        $location = $data['data']['location'] ?? '';
        if (!is_string($location) || $location === '') {
            return ['ok' => false, 'error' => 'WG API не вернул URL для входа'];
        }

        return ['ok' => true, 'location' => $location];
    }

    public function prolongateToken(string $accessToken, string $realm, int $expiresAt = 1209600): array
    {
        $realm = self::normalizeRealm($realm);
        $appId = $this->applicationIdForRealm($realm);
        if ($appId === '') {
            if (!function_exists('game_api_ru_api_label')) {
                require_once __DIR__ . '/game_api.php';
            }

            return ['ok' => false, 'error' => $realm === 'ru'
                ? (game_api_ru_api_label('ru') . ' application_id не настроен')
                : 'WG application_id не настроен'];
        }

        $accessToken = trim($accessToken);
        if ($accessToken === '') {
            return ['ok' => false, 'error' => 'Пустой access_token'];
        }

        $apiBase = self::apiBaseForRealm($realm);
        $url = $apiBase . '/wot/auth/prolongate/';
        $postFields = http_build_query([
            'application_id' => $appId,
            'access_token' => $accessToken,
            'expires_at' => $expiresAt,
        ]);

        $response = $this->httpPost($url, $postFields);
        if (!$response['ok']) {
            return ['ok' => false, 'error' => $response['error'] ?? 'Ошибка запроса к WG API'];
        }

        $data = $response['data'];
        if (!is_array($data) || ($data['status'] ?? '') !== 'ok') {
            return ['ok' => false, 'error' => 'access_token не подтверждён'];
        }

        $payload = $data['data'] ?? [];
        if (!is_array($payload)) {
            return ['ok' => false, 'error' => 'Некорректный ответ WG API'];
        }

        $accountId = (int) ($payload['account_id'] ?? 0);
        if ($accountId <= 0) {
            return ['ok' => false, 'error' => 'account_id не получен'];
        }

        return [
            'ok' => true,
            'account_id' => $accountId,
            'access_token' => (string) ($payload['access_token'] ?? $accessToken),
            'expires_at' => (int) ($payload['expires_at'] ?? 0),
        ];
    }

    public function fetchAccountNicknameByToken(string $accessToken, string $realm): array
    {
        $realm = self::normalizeRealm($realm);
        $appId = $this->applicationIdForRealm($realm);
        $accessToken = trim($accessToken);
        if ($appId === '' || $accessToken === '') {
            return ['ok' => false, 'error' => 'invalid request'];
        }

        $apiBase = self::apiBaseForRealm($realm);
        $url = $apiBase . '/wot/account/info/?' . http_build_query([
            'application_id' => $appId,
            'access_token' => $accessToken,
            'fields' => 'nickname',
        ]);

        return $this->fetchAccountNicknameFromUrl($url);
    }

    public function fetchAccountNickname(int $accountId, string $realm): array
    {
        $realm = self::normalizeRealm($realm);
        $accountId = (int) $accountId;
        $appId = $this->applicationIdForRealm($realm);
        if ($appId === '' || $accountId <= 0) {
            return ['ok' => false, 'error' => 'invalid request'];
        }

        $apiBase = self::apiBaseForRealm($realm);
        $url = $apiBase . '/wot/account/info/?' . http_build_query([
            'application_id' => $appId,
            'account_id' => $accountId,
            'fields' => 'nickname',
        ]);

        return $this->fetchAccountNicknameFromUrl($url, $accountId);
    }

    private function fetchAccountNicknameFromUrl(string $url, int $accountId = 0): array
    {
        $response = $this->httpGet($url);
        if (!$response['ok']) {
            return ['ok' => false, 'error' => $response['error'] ?? 'Ошибка запроса к WG API'];
        }

        $nickname = $this->parseAccountNickname($response['data'] ?? null, $accountId);
        if ($nickname === null || $nickname === '') {
            return ['ok' => false, 'error' => 'nickname не получен'];
        }

        return ['ok' => true, 'nickname' => $nickname];
    }

    private function parseAccountNickname(mixed $data, int $accountId = 0): ?string
    {
        if (!is_array($data) || ($data['status'] ?? '') !== 'ok' || !is_array($data['data'] ?? null)) {
            return null;
        }

        $payload = $data['data'];
        if ($accountId > 0) {
            $account = $payload[(string) $accountId] ?? $payload[$accountId] ?? null;
            if (is_array($account)) {
                $nickname = trim((string) ($account['nickname'] ?? ''));

                return $nickname !== '' ? $nickname : null;
            }
        }

        foreach ($payload as $account) {
            if (!is_array($account)) {
                continue;
            }
            $nickname = trim((string) ($account['nickname'] ?? ''));
            if ($nickname !== '') {
                return $nickname;
            }
        }

        return null;
    }

    private function httpGet(string $url): array
    {
        if (!function_exists('curl_init')) {
            return ['ok' => false, 'error' => 'cURL недоступен'];
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
            ],
        ]);

        $raw = curl_exec($ch);
        $errno = curl_errno($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($errno !== 0 || !is_string($raw)) {
            return ['ok' => false, 'error' => 'Сетевая ошибка при обращении к WG API'];
        }

        if ($httpCode < 200 || $httpCode >= 300) {
            return ['ok' => false, 'error' => 'WG API вернул HTTP ' . $httpCode];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return ['ok' => false, 'error' => 'Некорректный JSON от WG API'];
        }

        return ['ok' => true, 'data' => $decoded];
    }

    private function httpPost(string $url, string $body): array
    {
        if (!function_exists('curl_init')) {
            return ['ok' => false, 'error' => 'cURL недоступен'];
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/x-www-form-urlencoded',
                'Accept: application/json',
            ],
        ]);

        $raw = curl_exec($ch);
        $errno = curl_errno($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($errno !== 0 || !is_string($raw)) {
            return ['ok' => false, 'error' => 'Сетевая ошибка при обращении к WG API'];
        }

        if ($httpCode < 200 || $httpCode >= 300) {
            return ['ok' => false, 'error' => 'WG API вернул HTTP ' . $httpCode];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return ['ok' => false, 'error' => 'Некорректный JSON от WG API'];
        }

        return ['ok' => true, 'data' => $decoded];
    }
}
