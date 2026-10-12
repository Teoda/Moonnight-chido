-- AlterTable
ALTER TABLE `pagos` MODIFY `tipo` ENUM('SALA', 'SALDO_SALA', 'ANTICIPO_PEDIDO', 'SALDO_PEDIDO', 'TIEMPO_EXTRA', 'CONSUMO', 'REEMBOLSO') NOT NULL;

-- AlterTable
ALTER TABLE `reservaciones` ADD COLUMN `anticipoSala` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Las reservaciones web anteriores se pagaban completas en línea: su anticipo era la sala entera.
UPDATE `reservaciones` SET `anticipoSala` = `subtotalSala` WHERE `canal` = 'WEB';

-- CreateTable
CREATE TABLE `tarjetas_guardadas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clienteId` INTEGER NOT NULL,
    `marca` VARCHAR(20) NOT NULL,
    `ultimos4` CHAR(4) NOT NULL,
    `mesExp` INTEGER NOT NULL,
    `anioExp` INTEGER NOT NULL,
    `titular` VARCHAR(120) NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tarjetas_guardadas_token_key`(`token`),
    INDEX `tarjetas_guardadas_clienteId_idx`(`clienteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tarjetas_guardadas` ADD CONSTRAINT `tarjetas_guardadas_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
