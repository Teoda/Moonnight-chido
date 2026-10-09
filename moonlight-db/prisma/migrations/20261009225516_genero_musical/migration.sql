-- DropForeignKey
ALTER TABLE `salas` DROP FOREIGN KEY `salas_tematicaId_fkey`;

-- DropIndex
DROP INDEX `salas_tematicaId_fkey` ON `salas`;

-- AlterTable
ALTER TABLE `reservaciones` ADD COLUMN `artistas` VARCHAR(1000) NULL,
    ADD COLUMN `canciones` TEXT NULL,
    ADD COLUMN `tematicaId` INTEGER NULL;

-- AlterTable
ALTER TABLE `salas` MODIFY `tematicaId` INTEGER NULL;

-- AlterTable
ALTER TABLE `tematicas` ADD COLUMN `activo` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `orden` INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE `salas` ADD CONSTRAINT `salas_tematicaId_fkey` FOREIGN KEY (`tematicaId`) REFERENCES `tematicas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservaciones` ADD CONSTRAINT `reservaciones_tematicaId_fkey` FOREIGN KEY (`tematicaId`) REFERENCES `tematicas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
