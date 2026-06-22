/*
  Warnings:

  - Made the column `unidade` on table `Usuario` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Usuario" ALTER COLUMN "unidade" SET NOT NULL,
ALTER COLUMN "unidade" SET DEFAULT 'N/A';
