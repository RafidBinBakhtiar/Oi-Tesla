# Oi Tesla Pool — Design Notes

This document is written *before* the implementation and pins down the rules the
code has to follow. If the code and this document disagree, one of them is a bug.

## 1. Actors

| Actor | Who (seed cast) | Can do |
|---|---|---|
| Passenger | Nusrat, Rafiq, Shirin | sign up / sign in, estimate, request, track, cancel, view history |
| Driver + Tesla | Jashim + **Bullet** (3 seats) | sign in, go online/offline, see relevant requests, accept, arrive / start / complete each rider, view pool history |
| Pool | one per active trip of a Tesla | groups compatible ride requests into one vehicle, never over capacity |

## 2. Geography (keep it simple)

* `locations` are **zones / clusters** (e.g. *Banani–Gulshan*, *Mohakhali–Tejgaon*).
* `sub_locations` are named pickup/drop points inside a zone (e.g. *Banani Road 11*,
  *Mohakhali*, *Gulshan 1*), each with a single `lat/lng` centre point.
* Distances are computed with an **equirectangular projection** (flat-earth
  approximation, accurate to well under 1 m at city scale), rounded to whole metres.
  No routing API, no road graph — straight-line distance is the documented proxy.
* Travel time is `distance / AVG_SPEED` with `AVG_SPEED = 20 km/h`
  (a battery rickshaw's realistic cruising speed on Dhaka side roads), i.e.
  **0.18 s per metre**.

## 3. Ride lifecycle

```
REQUESTED ──► MATCHED ──► DRIVER_ARRIVED ──► STARTED ──► COMPLETED
    │            │              │
    └────────────┴──────────────┴──► CANCELLED   (passenger, before pickup)
```

| From | To | Who |
|---|---|---|
| REQUESTED | MATCHED | system (auto-pool) or driver (accept) |
| MATCHED | DRIVER_ARRIVED | driver of the pool |
| DRIVER_ARRIVED | STARTED | driver of the pool |
| STARTED | COMPLETED | driver of the pool |
| REQUESTED / MATCHED / DRIVER_ARRIVED | CANCELLED | the passenger who owns the ride |

Anything else is rejected with `409 INVALID_TRANSITION`. Arrive/start/complete are
**per rider**, not per pool, because pooled riders are dropped at different places:
Nusrat is COMPLETED at Mohakhali while Rafiq is still STARTED on the way to Gulshan 1.

Every transition writes a row to `ride_status_events` (from, to, actor, note, time) so
history can explain exactly what happened.

### Pool lifecycle (derived, never set by hand)

| Pool status | Meaning |
|---|---|
| OPEN | Created when a driver accepts a request. Accepts new compatible riders. |
| IN_PROGRESS | At least one rider is on board (STARTED). **Closed to new riders.** |
| COMPLETED | No active riders left and at least one rider completed. |
| CANCELLED | Every rider cancelled before anyone completed. |

Invariant: `pools.occupied_seats = Σ seats of members in MATCHED / DRIVER_ARRIVED / STARTED`.
Seats are released on cancel and on drop-off.

## 4. Matching rule (the pooling engine)

A ride request **R** may join an existing pool **P** only if *all* of these hold
(evaluated in this order, cheapest first):

1. **Pool open** — `P.status = OPEN` (nobody on board yet) and its driver is online.
2. **Same pickup cluster** — R's pickup sub-location is in the same zone as P's origin.
3. **Heading** — the bearing of R (pickup → drop-off) is within **60°** of the pool's
   trajectory heading (pool origin → first rider's drop-off).
4. **Detour** — the planner builds the pooled route: origin → other pickups (nearest
   first) → drop-offs in the order that minimises total distance, trying every
   permutation (≤ 3! = 6). Every member's extra time vs. riding alone must be
   **≤ 300 s**. If no drop-off order satisfies everyone, R does not fit.
5. **Capacity** — `P.occupied_seats + R.seats ≤ P.capacity`, re-checked **under a row
   lock** (see §6).

**How it matches:** when a passenger requests a ride, the engine immediately tries
every OPEN pool in the pickup cluster (best added detour first). If one fits, the ride
is MATCHED straight away. If none fits, the ride stays REQUESTED and shows up on
drivers' "relevant requests" list; a driver accepting it creates a new pool (or adds
it to the driver's own OPEN pool if the same rules pass).

### The story, worked through

| Sub-location | lat | lng |
|---|---|---|
| Banani Road 11 | 23.7940 | 90.4043 |
| Mohakhali | 23.7784 | 90.4000 |
| Gulshan 1 | 23.7805 | 90.4163 |

* Nusrat: Banani Rd 11 → Mohakhali = **1 789 m**, heading 194.2°.
* Rafiq: Banani Rd 11 → Gulshan 1 = **1 935 m**, heading 140.9°.
* Heading difference 53.3° ≤ 60° ✅
* Drop Nusrat first: Rafiq rides 1 789 + 1 675 = 3 464 m instead of 1 935 m →
  +1 529 m → **275 s** ≤ 300 s ✅ (Nusrat's detour: 0 s).
* Drop Rafiq first would cost Nusrat +1 821 m → 328 s ❌, so the planner picks
  *Mohakhali first, then Gulshan 1*.
* Shirin (Banani Rd 11 → Mohakhali, 1 seat) 30 s later fits into the last seat.
  If she asks for 2 seats she stays REQUESTED: *3 − 2 = 1 seat free*.

## 5. Fare model

All money is stored as **integer paisa** (৳1 = 100 paisa). Integers make every
calculation exact (no `0.1 + 0.2` problems), fit comfortably in `INTEGER`, and are
safe JavaScript numbers.

```
distanceCharge = distance_m × 2 paisa × seats            (৳20 per km per seat)
baseFare       = 3 000 paisa                             (৳30 per request)
poolDiscount   = floor(distanceCharge × 25 / 100)  if the pool has ≥ 2 riders, else 0
passengerFare  = baseFare + distanceCharge − poolDiscount
```

Each passenger pays for **their own** pickup → drop-off distance, never for the
detour the pool causes them.

| | Nusrat (1 789 m) | Rafiq (1 935 m) |
|---|---|---|
| baseFare | 3 000 | 3 000 |
| distanceCharge | 3 578 | 3 870 |
| solo fare | **6 578 (৳65.78)** | **6 870 (৳68.70)** |
| poolDiscount | 894 | 967 |
| pooled fare | **5 684 (৳56.84)** | **5 903 (৳59.03)** |

### When is a fare fixed?

* `ESTIMATE` — written when the ride is requested (solo price = the maximum you can pay).
* `QUOTE` — rewritten for every not-yet-picked-up member whenever pool membership
  changes (someone joins → discount appears; someone cancels → it may disappear).
* The fare **locks at pickup** (STARTED). Later cancellations by co-riders do not
  change a rider who is already on board.
* `FINAL` — written on COMPLETED, together with a `payments` row.

Rows in `fare_calculations` are append-only, so the fare history of any ride can be
replayed.

### Payment

`CASH` (driver collects) or simulated **TeslaPay** wallet. For TeslaPay the solo
estimate must be covered by the wallet at request time; the final fare (≤ estimate)
is debited atomically on completion.

## 6. Consistency & concurrency

The hard case: Bullet has one seat left, Nusrat and Shirin claim it at the same instant.

* Every pool mutation runs in one database transaction that first takes
  `SELECT … FROM pools WHERE id = $1 FOR UPDATE`. The second transaction blocks until
  the first commits, then re-reads `occupied_seats` and members and re-runs the full
  matching rule. Exactly one of them gets the seat; the other stays REQUESTED.
* Lock order is always **pool → ride request**, to avoid deadlocks.
* Database constraints are the last line of defence, even if application code is wrong:
  * `CHECK (occupied_seats BETWEEN 0 AND capacity)` on `pools`
  * `UNIQUE (ride_request_id)` on `pool_memberships` (a ride is in at most one pool)
  * partial unique index: one active pool per vehicle
  * partial unique index: one active ride per passenger
  * `CHECK (wallet_balance_paisa >= 0)` on `passengers`

At larger scale: shard matching by zone so each zone's pools are handled by a single
writer, keep row locks short, and move to optimistic versioning if lock contention shows
up in metrics (see README, *If Oi Tesla goes viral*).

## 7. Authorization

* JWT (HS256, 12 h) carrying `sub` and `role` (`passenger` | `driver`).
* Passengers only ever see their own rides. Asking for someone else's ride returns
  **404** (not 403) so ride IDs cannot be probed.
* Passengers see the pool's vehicle, driver, seat count and *number* of co-riders — never
  co-riders' names, destinations or fares.
* Drivers can act only on rides that belong to their own active pool.

## 8. Assumptions

1. One Tesla per driver; capacity fixed per vehicle (Bullet = 3).
2. A passenger may have only one active ride at a time.
3. A ride may request 1–3 seats (a passenger travelling with a friend or luggage).
4. New riders can join a pool only before anyone is picked up.
5. Straight-line distance is an acceptable proxy for road distance in an MVP.
6. REQUESTED rides do not expire automatically (would be a background job later).
7. No cancellation fee in v1; passengers may cancel any time before pickup.
