package main

import (
	"testing"
	"time"
)

func TestRateLimiterAllowsBurstThenBlocks(t *testing.T) {
	rl := newRateLimiter(60, 3) // 每秒 1 次，可先連發 3 次
	now := time.Now()

	for i := range 3 {
		if ok, _ := rl.allow(1, now); !ok {
			t.Fatalf("call %d should be allowed within burst", i+1)
		}
	}

	ok, retryAfter := rl.allow(1, now)
	if ok {
		t.Fatal("call beyond burst should be blocked")
	}
	if retryAfter <= 0 {
		t.Errorf("retryAfter = %d, want a positive hint", retryAfter)
	}
}

func TestRateLimiterRefillsOverTime(t *testing.T) {
	rl := newRateLimiter(60, 1)
	now := time.Now()

	if ok, _ := rl.allow(1, now); !ok {
		t.Fatal("first call should be allowed")
	}
	if ok, _ := rl.allow(1, now); ok {
		t.Fatal("second immediate call should be blocked")
	}
	if ok, _ := rl.allow(1, now.Add(2*time.Second)); !ok {
		t.Fatal("call after refill should be allowed")
	}
}

func TestRateLimiterIsolatesKeys(t *testing.T) {
	rl := newRateLimiter(60, 1)
	now := time.Now()

	if ok, _ := rl.allow(1, now); !ok {
		t.Fatal("author 1 first call should be allowed")
	}
	if ok, _ := rl.allow(2, now); !ok {
		t.Fatal("author 2 must not be affected by author 1")
	}
}

// 長時間沒活動的項目要被清掉，否則 map 會隨著使用者數量無限成長。
func TestRateLimiterSweepsIdleVisitors(t *testing.T) {
	rl := newRateLimiter(60, 1)
	now := time.Now()

	rl.allow(1, now)
	if len(rl.visitors) != 1 {
		t.Fatalf("visitors = %d, want 1", len(rl.visitors))
	}

	rl.allow(2, now.Add(rl.ttl+time.Minute))
	if _, still := rl.visitors[1]; still {
		t.Error("idle visitor should have been swept")
	}
}
