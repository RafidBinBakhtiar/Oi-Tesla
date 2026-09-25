-- Integrity rules that Prisma's schema language cannot express.
-- These are the last line of defence: even buggy application code cannot
-- overbook Bullet or double-assign a ride. See docs/design.md §6.

-- Geography
ALTER TABLE "sub_locations"
  ADD CONSTRAINT "sub_locations_lat_range" CHECK ("lat" BETWEEN -90 AND 90),
  ADD CONSTRAINT "sub_locations_lng_range" CHECK ("lng" BETWEEN -180 AND 180);

-- Money never goes negative
ALTER TABLE "passengers"
  ADD CONSTRAINT "passengers_wallet_non_negative" CHECK ("wallet_balance_paisa" >= 0);

-- Vehicles
ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_capacity_range" CHECK ("capacity" BETWEEN 1 AND 6);

-- Pools: occupied seats can never exceed capacity
ALTER TABLE "pools"
  ADD CONSTRAINT "pools_capacity_range" CHECK ("capacity" BETWEEN 1 AND 6),
  ADD CONSTRAINT "pools_occupied_within_capacity" CHECK ("occupied_seats" BETWEEN 0 AND "capacity");

-- A Tesla drives at most one active pool at a time
CREATE UNIQUE INDEX "pools_one_active_per_vehicle"
  ON "pools" ("vehicle_id")
  WHERE "status" IN ('OPEN', 'IN_PROGRESS');

-- Trajectories
ALTER TABLE "spatial_trajectories"
  ADD CONSTRAINT "spatial_trajectories_heading_range" CHECK ("route_heading_deg" BETWEEN 0 AND 359),
  ADD CONSTRAINT "spatial_trajectories_detour_positive" CHECK ("max_allowable_detour_seconds" > 0);

-- Ride requests
ALTER TABLE "ride_requests"
  ADD CONSTRAINT "ride_requests_seats_range" CHECK ("seats_requested" BETWEEN 1 AND 3),
  ADD CONSTRAINT "ride_requests_distinct_endpoints" CHECK ("pickup_sub_location_id" <> "dropoff_sub_location_id"),
  ADD CONSTRAINT "ride_requests_distance_positive" CHECK ("distance_m" > 0);

-- A passenger has at most one ride in flight
CREATE UNIQUE INDEX "ride_requests_one_active_per_passenger"
  ON "ride_requests" ("passenger_id")
  WHERE "status" IN ('REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED');

-- Pool memberships
ALTER TABLE "pool_memberships"
  ADD CONSTRAINT "pool_memberships_seats_positive" CHECK ("seats" >= 1);

-- Fares: every row must add up
ALTER TABLE "fare_calculations"
  ADD CONSTRAINT "fare_calculations_non_negative" CHECK (
    "base_fare_paisa" >= 0 AND "distance_fare_paisa" >= 0 AND "pool_discount_paisa" >= 0
    AND "distance_m" > 0 AND "seats" >= 1 AND "co_rider_count" >= 0
  ),
  ADD CONSTRAINT "fare_calculations_discount_bounded" CHECK ("pool_discount_paisa" <= "distance_fare_paisa"),
  ADD CONSTRAINT "fare_calculations_sum" CHECK (
    "final_fare_paisa" = "base_fare_paisa" + "distance_fare_paisa" - "pool_discount_paisa"
  );

-- Payments
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_non_negative" CHECK ("amount_paisa" >= 0);
