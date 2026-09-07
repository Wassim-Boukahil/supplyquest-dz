-- CreateEnum
CREATE TYPE "ForecastDataStatus" AS ENUM ('SUFFICIENT', 'LIMITED', 'INSUFFICIENT');

-- CreateEnum
CREATE TYPE "ForecastQuality" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "ForecastPointType" AS ENUM ('FORECAST', 'BACKTEST');

-- AlterTable
ALTER TABLE "replenishment_recommendations" ADD COLUMN     "forecast_demand" DECIMAL(12,4),
ADD COLUMN     "forecast_horizon_days" INTEGER,
ADD COLUMN     "forecast_method" TEXT,
ADD COLUMN     "forecast_quality" TEXT,
ADD COLUMN     "forecast_run_id" UUID,
ADD COLUMN     "recommendation_mode" TEXT NOT NULL DEFAULT 'BASELINE';

-- CreateTable
CREATE TABLE "forecast_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID,
    "generated_by_id" UUID,
    "horizon_days" INTEGER NOT NULL,
    "data_status" "ForecastDataStatus" NOT NULL,
    "quality" "ForecastQuality" NOT NULL,
    "selected_method" TEXT NOT NULL,
    "candidate_methods" JSONB NOT NULL,
    "candidate_metrics" JSONB NOT NULL,
    "history_start" TIMESTAMP(3),
    "history_end" TIMESTAMP(3),
    "observation_count" INTEGER NOT NULL,
    "non_zero_observation_count" INTEGER NOT NULL,
    "evaluation_period" INTEGER NOT NULL,
    "mae" DECIMAL(12,4),
    "rmse" DECIMAL(12,4),
    "mape" DECIMAL(12,4),
    "trend_direction" TEXT NOT NULL,
    "trend_magnitude" DECIMAL(12,4),
    "seasonality_detected" BOOLEAN NOT NULL,
    "seasonality_type" TEXT,
    "seasonality_strength" DECIMAL(8,4),
    "uncertainty_available" BOOLEAN NOT NULL,
    "uncertainty_method" TEXT,
    "selection_reason" TEXT NOT NULL,
    "quality_reason" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forecast_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_points" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "forecast_date" TIMESTAMP(3) NOT NULL,
    "point_type" "ForecastPointType" NOT NULL,
    "predicted_quantity" DECIMAL(12,4) NOT NULL,
    "actual_quantity" DECIMAL(12,4),
    "lower_bound" DECIMAL(12,4),
    "upper_bound" DECIMAL(12,4),
    "error" DECIMAL(12,4),

    CONSTRAINT "forecast_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forecast_runs_organization_id_created_at_idx" ON "forecast_runs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "forecast_runs_organization_id_product_id_idx" ON "forecast_runs"("organization_id", "product_id");

-- CreateIndex
CREATE INDEX "forecast_runs_organization_id_warehouse_id_idx" ON "forecast_runs"("organization_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "forecast_runs_product_id_warehouse_id_generated_at_idx" ON "forecast_runs"("product_id", "warehouse_id", "generated_at");

-- CreateIndex
CREATE INDEX "forecast_points_run_id_forecast_date_idx" ON "forecast_points"("run_id", "forecast_date");

-- CreateIndex
CREATE UNIQUE INDEX "forecast_points_run_id_forecast_date_point_type_key" ON "forecast_points"("run_id", "forecast_date", "point_type");

-- CreateIndex
CREATE INDEX "replenishment_recommendations_forecast_run_id_idx" ON "replenishment_recommendations"("forecast_run_id");

-- AddForeignKey
ALTER TABLE "replenishment_recommendations" ADD CONSTRAINT "replenishment_recommendations_forecast_run_id_fkey" FOREIGN KEY ("forecast_run_id") REFERENCES "forecast_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_runs" ADD CONSTRAINT "forecast_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_runs" ADD CONSTRAINT "forecast_runs_product_id_organization_id_fkey" FOREIGN KEY ("product_id", "organization_id") REFERENCES "products"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_runs" ADD CONSTRAINT "forecast_runs_warehouse_id_organization_id_fkey" FOREIGN KEY ("warehouse_id", "organization_id") REFERENCES "warehouses"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_runs" ADD CONSTRAINT "forecast_runs_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_points" ADD CONSTRAINT "forecast_points_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "forecast_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
