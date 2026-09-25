-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PoolStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FareKind" AS ENUM ('ESTIMATE', 'QUOTE', 'FINAL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TESLAPAY');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('PASSENGER', 'DRIVER', 'SYSTEM');

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(80) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "location_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "sub_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passengers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(80) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "password_hash" VARCHAR(100) NOT NULL,
    "wallet_balance_paisa" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "passengers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(80) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "license_number" VARCHAR(40) NOT NULL,
    "password_hash" VARCHAR(100) NOT NULL,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "current_sub_location_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "driver_id" UUID NOT NULL,
    "model_name" VARCHAR(40) NOT NULL,
    "plate_number" VARCHAR(40) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pools" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vehicle_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "current_sub_location_id" UUID NOT NULL,
    "capacity" INTEGER NOT NULL,
    "occupied_seats" INTEGER NOT NULL DEFAULT 0,
    "status" "PoolStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spatial_trajectories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pool_id" UUID NOT NULL,
    "origin_sub_location_id" UUID NOT NULL,
    "primary_destination_sub_location_id" UUID NOT NULL,
    "route_heading_deg" INTEGER NOT NULL,
    "max_allowable_detour_seconds" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "spatial_trajectories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "passenger_id" UUID NOT NULL,
    "pickup_sub_location_id" UUID NOT NULL,
    "dropoff_sub_location_id" UUID NOT NULL,
    "seats_requested" INTEGER NOT NULL DEFAULT 1,
    "distance_m" INTEGER NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "status" "RideStatus" NOT NULL DEFAULT 'REQUESTED',
    "cancel_reason" VARCHAR(200),
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matched_at" TIMESTAMPTZ(3),
    "arrived_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ride_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pool_id" UUID NOT NULL,
    "ride_request_id" UUID NOT NULL,
    "seats" INTEGER NOT NULL,
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(3),

    CONSTRAINT "pool_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fare_calculations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ride_request_id" UUID NOT NULL,
    "kind" "FareKind" NOT NULL,
    "distance_m" INTEGER NOT NULL,
    "seats" INTEGER NOT NULL,
    "base_fare_paisa" INTEGER NOT NULL,
    "distance_fare_paisa" INTEGER NOT NULL,
    "pool_discount_paisa" INTEGER NOT NULL,
    "final_fare_paisa" INTEGER NOT NULL,
    "is_pooled" BOOLEAN NOT NULL,
    "co_rider_count" INTEGER NOT NULL,
    "calculated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fare_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_status_events" (
    "id" SERIAL NOT NULL,
    "ride_request_id" UUID NOT NULL,
    "pool_id" UUID,
    "from_status" "RideStatus",
    "to_status" "RideStatus" NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" UUID,
    "note" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ride_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ride_request_id" UUID NOT NULL,
    "passenger_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount_paisa" INTEGER NOT NULL,
    "note" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locations_code_key" ON "locations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sub_locations_code_key" ON "sub_locations"("code");

-- CreateIndex
CREATE INDEX "sub_locations_location_id_idx" ON "sub_locations"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "passengers_phone_number_key" ON "passengers"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_phone_number_key" ON "drivers"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_license_number_key" ON "drivers"("license_number");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_driver_id_key" ON "vehicles"("driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_number_key" ON "vehicles"("plate_number");

-- CreateIndex
CREATE INDEX "pools_status_current_sub_location_id_idx" ON "pools"("status", "current_sub_location_id");

-- CreateIndex
CREATE INDEX "pools_driver_id_created_at_idx" ON "pools"("driver_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "spatial_trajectories_pool_id_key" ON "spatial_trajectories"("pool_id");

-- CreateIndex
CREATE INDEX "ride_requests_passenger_id_requested_at_idx" ON "ride_requests"("passenger_id", "requested_at" DESC);

-- CreateIndex
CREATE INDEX "ride_requests_status_pickup_sub_location_id_idx" ON "ride_requests"("status", "pickup_sub_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "pool_memberships_ride_request_id_key" ON "pool_memberships"("ride_request_id");

-- CreateIndex
CREATE INDEX "pool_memberships_pool_id_idx" ON "pool_memberships"("pool_id");

-- CreateIndex
CREATE INDEX "fare_calculations_ride_request_id_calculated_at_idx" ON "fare_calculations"("ride_request_id", "calculated_at");

-- CreateIndex
CREATE INDEX "ride_status_events_ride_request_id_id_idx" ON "ride_status_events"("ride_request_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_ride_request_id_key" ON "payments"("ride_request_id");

-- CreateIndex
CREATE INDEX "payments_passenger_id_created_at_idx" ON "payments"("passenger_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "sub_locations" ADD CONSTRAINT "sub_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_current_sub_location_id_fkey" FOREIGN KEY ("current_sub_location_id") REFERENCES "sub_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_current_sub_location_id_fkey" FOREIGN KEY ("current_sub_location_id") REFERENCES "sub_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spatial_trajectories" ADD CONSTRAINT "spatial_trajectories_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spatial_trajectories" ADD CONSTRAINT "spatial_trajectories_origin_sub_location_id_fkey" FOREIGN KEY ("origin_sub_location_id") REFERENCES "sub_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spatial_trajectories" ADD CONSTRAINT "spatial_trajectories_primary_destination_sub_location_id_fkey" FOREIGN KEY ("primary_destination_sub_location_id") REFERENCES "sub_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "passengers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_pickup_sub_location_id_fkey" FOREIGN KEY ("pickup_sub_location_id") REFERENCES "sub_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_dropoff_sub_location_id_fkey" FOREIGN KEY ("dropoff_sub_location_id") REFERENCES "sub_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_memberships" ADD CONSTRAINT "pool_memberships_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_memberships" ADD CONSTRAINT "pool_memberships_ride_request_id_fkey" FOREIGN KEY ("ride_request_id") REFERENCES "ride_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fare_calculations" ADD CONSTRAINT "fare_calculations_ride_request_id_fkey" FOREIGN KEY ("ride_request_id") REFERENCES "ride_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_status_events" ADD CONSTRAINT "ride_status_events_ride_request_id_fkey" FOREIGN KEY ("ride_request_id") REFERENCES "ride_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_status_events" ADD CONSTRAINT "ride_status_events_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_ride_request_id_fkey" FOREIGN KEY ("ride_request_id") REFERENCES "ride_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "passengers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
