-- Las salas ya no tienen temática fija (el género lo elige el cliente en cada reservación):
-- se elimina salas.tematicaId. La llave foránea de tipoSalaId usaba el índice compuesto
-- (tipoSalaId, tematicaId), así que se quita y se vuelve a crear sobre el índice nuevo.

-- DropForeignKey
ALTER TABLE `salas` DROP FOREIGN KEY `salas_tematicaId_fkey`;

-- DropForeignKey
ALTER TABLE `salas` DROP FOREIGN KEY `salas_tipoSalaId_fkey`;

-- DropIndex
DROP INDEX `salas_tematicaId_fkey` ON `salas`;

-- DropIndex
DROP INDEX `salas_tipoSalaId_tematicaId_idx` ON `salas`;

-- AlterTable
ALTER TABLE `salas` DROP COLUMN `tematicaId`;

-- CreateIndex
CREATE INDEX `salas_tipoSalaId_idx` ON `salas`(`tipoSalaId`);

-- AddForeignKey
ALTER TABLE `salas` ADD CONSTRAINT `salas_tipoSalaId_fkey` FOREIGN KEY (`tipoSalaId`) REFERENCES `tipos_sala`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
