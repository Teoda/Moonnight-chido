-- AlterTable
ALTER TABLE `usuarios` MODIFY `rol` ENUM('SUPERADMIN', 'ADMIN', 'OPERACIONES', 'FINANZAS', 'RECEPCION', 'BARRA', 'MARKETING', 'LIMPIEZA') NOT NULL;

-- CreateTable
CREATE TABLE `turnos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuarioId` INTEGER NOT NULL,
    `inicio` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fin` DATETIME(3) NULL,
    `terminadoPor` INTEGER NULL,

    INDEX `turnos_usuarioId_idx`(`usuarioId`),
    INDEX `turnos_fin_idx`(`fin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `turnos` ADD CONSTRAINT `turnos_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
