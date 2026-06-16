<?php

const USER_LOGIN_THROTTLE_ENABLED = false;

const USER_LOGIN_THROTTLE_WINDOW_SEC = 900;

const USER_LOGIN_THROTTLE_MAX_FAILS = 5;

const USER_LOGIN_THROTTLE_LOCK_SEC = 1800;

function user_login_throttle_ip_key(): string {
    $ip = isset($_SERVER['REMOTE_ADDR']) ? trim((string) $_SERVER['REMOTE_ADDR']) : '';
    if ($ip === '') {
        $ip = '0.0.0.0';
    }
    return hash('sha256', $ip, false);
}

function user_login_throttle_retry_after_seconds($db): ?int {
    if (!USER_LOGIN_THROTTLE_ENABLED) {
        return null;
    }
    $key = user_login_throttle_ip_key();
    $row = $db->fetchOne(
        'SELECT locked_until FROM site_login_throttle WHERE ip_key = ?',
        [$key]
    );
    if (!$row) {
        return null;
    }
    $now = time();
    $lockedUntil = (int) $row['locked_until'];
    if ($lockedUntil > $now) {
        return $lockedUntil - $now;
    }
    if ($lockedUntil > 0 && $lockedUntil <= $now) {
        $db->delete('DELETE FROM site_login_throttle WHERE ip_key = ?', [$key]);
    }
    return null;
}

function user_login_throttle_attempts_remaining($db): int {
    if (!USER_LOGIN_THROTTLE_ENABLED) {
        return USER_LOGIN_THROTTLE_MAX_FAILS;
    }
    $max = USER_LOGIN_THROTTLE_MAX_FAILS;
    $window = USER_LOGIN_THROTTLE_WINDOW_SEC;
    $key = user_login_throttle_ip_key();
    $now = time();
    $row = $db->fetchOne(
        'SELECT fail_count, window_start, locked_until FROM site_login_throttle WHERE ip_key = ?',
        [$key]
    );
    if (!$row) {
        return $max;
    }
    if ((int) $row['locked_until'] > $now) {
        return 0;
    }
    if ($now - (int) $row['window_start'] > $window) {
        return $max;
    }
    return max(0, $max - (int) $row['fail_count']);
}

function user_login_throttle_register_failure($db): void {
    if (!USER_LOGIN_THROTTLE_ENABLED) {
        return;
    }
    $key = user_login_throttle_ip_key();
    $now = time();
    $window = USER_LOGIN_THROTTLE_WINDOW_SEC;
    $max = USER_LOGIN_THROTTLE_MAX_FAILS;
    $lockSec = USER_LOGIN_THROTTLE_LOCK_SEC;

    $db->beginTransaction();
    try {
        $row = $db->fetchOne(
            'SELECT fail_count, window_start, locked_until FROM site_login_throttle WHERE ip_key = ? FOR UPDATE',
            [$key]
        );

        if ($row && (int) $row['locked_until'] > $now) {
            $db->commit();
            return;
        }

        if (!$row || $now - (int) $row['window_start'] > $window) {
            if ($row) {
                $db->query(
                    'UPDATE site_login_throttle SET fail_count = 1, window_start = ?, locked_until = 0 WHERE ip_key = ?',
                    [$now, $key]
                );
            } else {
                $db->query(
                    'INSERT INTO site_login_throttle (ip_key, fail_count, window_start, locked_until) VALUES (?, 1, ?, 0)',
                    [$key, $now]
                );
            }
        } else {
            $fail = (int) $row['fail_count'] + 1;
            $locked = ($fail >= $max) ? ($now + $lockSec) : 0;
            $db->query(
                'UPDATE site_login_throttle SET fail_count = ?, locked_until = ? WHERE ip_key = ?',
                [$fail, $locked, $key]
            );
        }
        $db->commit();
    } catch (Throwable $e) {
        $db->rollback();
        throw $e;
    }
}

function user_login_throttle_register_success($db): void {
    $key = user_login_throttle_ip_key();
    $db->delete('DELETE FROM site_login_throttle WHERE ip_key = ?', [$key]);
}
