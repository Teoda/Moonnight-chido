-- AlterTable
ALTER TABLE `productos_menu` ADD COLUMN `alcohol` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `descripcion` VARCHAR(500) NULL,
    ADD COLUMN `orden` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `seccion` VARCHAR(50) NOT NULL DEFAULT 'Otros',
    ADD COLUMN `tipoSalaId` INTEGER NULL,
    MODIFY `categoria` ENUM('ALIMENTO', 'BEBIDA', 'PAQUETE') NOT NULL;

-- CreateIndex
CREATE INDEX `productos_menu_activo_orden_idx` ON `productos_menu`(`activo`, `orden`);

-- AddForeignKey
ALTER TABLE `productos_menu` ADD CONSTRAINT `productos_menu_tipoSalaId_fkey` FOREIGN KEY (`tipoSalaId`) REFERENCES `tipos_sala`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

