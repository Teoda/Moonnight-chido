-- CreateTable
CREATE TABLE `tipos_sala` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(10) NOT NULL,
    `nombre` VARCHAR(50) NOT NULL,
    `capacidadMin` INTEGER NOT NULL,
    `capacidadMax` INTEGER NOT NULL,
    `precioHora` DECIMAL(10, 2) NOT NULL,
    `descripcion` VARCHAR(255) NULL,

    UNIQUE INDEX `tipos_sala_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tematicas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(50) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `fotoUrl` VARCHAR(255) NULL,

    UNIQUE INDEX `tematicas_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero` INTEGER NOT NULL,
    `tipoSalaId` INTEGER NOT NULL,
    `tematicaId` INTEGER NOT NULL,
    `estado` ENUM('ACTIVA', 'LIMPIEZA', 'MANTENIMIENTO') NOT NULL DEFAULT 'ACTIVA',
    `descripcion` VARCHAR(255) NULL,
    `fotoUrl` VARCHAR(255) NULL,

    UNIQUE INDEX `salas_numero_key`(`numero`),
    INDEX `salas_tipoSalaId_tematicaId_idx`(`tipoSalaId`, `tematicaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `horarios_operacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `diaSemana` INTEGER NOT NULL,
    `abre` VARCHAR(5) NOT NULL,
    `cierra` VARCHAR(5) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `horarios_operacion_diaSemana_key`(`diaSemana`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clientes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(120) NOT NULL,
    `telefono` VARCHAR(20) NULL,
    `email` VARCHAR(150) NULL,
    `passwordHash` VARCHAR(100) NULL,
    `aceptaPromos` BOOLEAN NOT NULL DEFAULT false,
    `intentosFallidos` INTEGER NOT NULL DEFAULT 0,
    `bloqueadoHasta` DATETIME(3) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `clientes_telefono_key`(`telefono`),
    UNIQUE INDEX `clientes_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(120) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `passwordHash` VARCHAR(100) NOT NULL,
    `rol` ENUM('ADMIN', 'OPERACIONES', 'FINANZAS', 'RECEPCION', 'BARRA', 'MARKETING', 'LIMPIEZA') NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `intentosFallidos` INTEGER NOT NULL DEFAULT 0,
    `bloqueadoHasta` DATETIME(3) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `usuarios_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sesiones` (
    `id` CHAR(64) NOT NULL,
    `usuarioId` INTEGER NULL,
    `clienteId` INTEGER NULL,
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ultimaActividad` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiraEn` DATETIME(3) NOT NULL,
    `ip` VARCHAR(45) NULL,
    `userAgent` VARCHAR(255) NULL,

    INDEX `sesiones_usuarioId_idx`(`usuarioId`),
    INDEX `sesiones_clienteId_idx`(`clienteId`),
    INDEX `sesiones_expiraEn_idx`(`expiraEn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promociones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `tipo` ENUM('DESCUENTO_ALIMENTOS', 'HAPPY_HOUR') NOT NULL,
    `porcentaje` DECIMAL(5, 2) NOT NULL,
    `visitasRequeridas` INTEGER NULL,
    `horaInicio` VARCHAR(5) NULL,
    `horaFin` VARCHAR(5) NULL,
    `diasSemana` VARCHAR(20) NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `vigenteDesde` DATETIME(3) NULL,
    `vigenteHasta` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reservaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(10) NOT NULL,
    `clienteId` INTEGER NOT NULL,
    `salaId` INTEGER NOT NULL,
    `inicio` DATETIME(3) NOT NULL,
    `fin` DATETIME(3) NOT NULL,
    `finOriginal` DATETIME(3) NULL,
    `personas` INTEGER NOT NULL,
    `estado` ENUM('PENDIENTE_PAGO', 'CONFIRMADA', 'EN_CURSO', 'FINALIZADA', 'CANCELADA', 'NO_SHOW') NOT NULL DEFAULT 'PENDIENTE_PAGO',
    `canal` ENUM('WEB', 'MOSTRADOR') NOT NULL DEFAULT 'WEB',
    `subtotalSala` DECIMAL(10, 2) NOT NULL,
    `expiraEn` DATETIME(3) NULL,
    `retrasoMin` INTEGER NOT NULL DEFAULT 0,
    `tiempoPerdidoMin` INTEGER NOT NULL DEFAULT 0,
    `promocionId` INTEGER NULL,
    `notas` TEXT NULL,
    `checkInEn` DATETIME(3) NULL,
    `checkOutEn` DATETIME(3) NULL,
    `creadaPorId` INTEGER NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `reservaciones_codigo_key`(`codigo`),
    INDEX `reservaciones_salaId_inicio_fin_idx`(`salaId`, `inicio`, `fin`),
    INDEX `reservaciones_clienteId_idx`(`clienteId`),
    INDEX `reservaciones_estado_inicio_idx`(`estado`, `inicio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pagos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reservacionId` INTEGER NOT NULL,
    `pedidoId` INTEGER NULL,
    `tipo` ENUM('SALA', 'ANTICIPO_PEDIDO', 'SALDO_PEDIDO', 'TIEMPO_EXTRA', 'CONSUMO', 'REEMBOLSO') NOT NULL,
    `metodo` ENUM('EFECTIVO', 'TARJETA') NOT NULL,
    `estado` ENUM('PENDIENTE', 'PAGADO', 'REEMBOLSADO', 'FALLIDO') NOT NULL DEFAULT 'PAGADO',
    `monto` DECIMAL(10, 2) NOT NULL,
    `enLinea` BOOLEAN NOT NULL DEFAULT false,
    `referencia` VARCHAR(100) NULL,
    `registradoPorId` INTEGER NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pagos_reservacionId_idx`(`reservacionId`),
    INDEX `pagos_pedidoId_idx`(`pedidoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cancelaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reservacionId` INTEGER NOT NULL,
    `motivo` VARCHAR(255) NULL,
    `horasAnticipacion` INTEGER NOT NULL,
    `reembolso` DECIMAL(10, 2) NOT NULL,
    `retenido` DECIMAL(10, 2) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `cancelaciones_reservacionId_key`(`reservacionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reagendaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reservacionId` INTEGER NOT NULL,
    `inicioAnterior` DATETIME(3) NOT NULL,
    `finAnterior` DATETIME(3) NOT NULL,
    `salaAnteriorId` INTEGER NOT NULL,
    `inicioNuevo` DATETIME(3) NOT NULL,
    `finNuevo` DATETIME(3) NOT NULL,
    `salaNuevaId` INTEGER NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reagendaciones_reservacionId_idx`(`reservacionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `extensiones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reservacionId` INTEGER NOT NULL,
    `minutos` INTEGER NOT NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `creadaPorId` INTEGER NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `extensiones_reservacionId_idx`(`reservacionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cuentas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reservacionId` INTEGER NOT NULL,
    `subtotalSala` DECIMAL(10, 2) NOT NULL,
    `subtotalExtras` DECIMAL(10, 2) NOT NULL,
    `subtotalPedidosAnticipados` DECIMAL(10, 2) NOT NULL,
    `subtotalConsumo` DECIMAL(10, 2) NOT NULL,
    `descuento` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(10, 2) NOT NULL,
    `pagadoPrevio` DECIMAL(10, 2) NOT NULL,
    `saldo` DECIMAL(10, 2) NOT NULL,
    `cerradaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cerradaPorId` INTEGER NULL,

    UNIQUE INDEX `cuentas_reservacionId_key`(`reservacionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `productos_menu` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `categoria` ENUM('ALIMENTO', 'BEBIDA') NOT NULL,
    `precio` DECIMAL(10, 2) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `productos_menu_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pedidos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reservacionId` INTEGER NOT NULL,
    `origen` ENUM('PREORDEN', 'QR_SALA', 'MOSTRADOR') NOT NULL DEFAULT 'QR_SALA',
    `estado` ENUM('EN_ESPERA', 'NUEVO', 'PREPARANDO', 'ENTREGADO', 'CANCELADO') NOT NULL DEFAULT 'NUEVO',
    `total` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `anticipo` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `saldoCobrado` BOOLEAN NOT NULL DEFAULT false,
    `notas` VARCHAR(255) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `entregadoEn` DATETIME(3) NULL,
    `atendidoPorId` INTEGER NULL,

    INDEX `pedidos_estado_creadoEn_idx`(`estado`, `creadoEn`),
    INDEX `pedidos_reservacionId_idx`(`reservacionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pedido_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pedidoId` INTEGER NOT NULL,
    `productoId` INTEGER NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `precioUnitario` DECIMAL(10, 2) NOT NULL,

    INDEX `pedido_items_pedidoId_idx`(`pedidoId`),
    INDEX `pedido_items_productoId_idx`(`productoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `limpiezas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `salaId` INTEGER NOT NULL,
    `reservacionId` INTEGER NULL,
    `estado` ENUM('PENDIENTE', 'EN_PROCESO', 'LISTA') NOT NULL DEFAULT 'PENDIENTE',
    `creadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `iniciadaEn` DATETIME(3) NULL,
    `terminadaEn` DATETIME(3) NULL,
    `realizadaPorId` INTEGER NULL,

    INDEX `limpiezas_estado_creadaEn_idx`(`estado`, `creadaEn`),
    INDEX `limpiezas_salaId_idx`(`salaId`),
    INDEX `limpiezas_reservacionId_idx`(`reservacionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `incidencias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `salaId` INTEGER NULL,
    `descripcion` TEXT NOT NULL,
    `estado` ENUM('ABIERTA', 'EN_PROCESO', 'RESUELTA') NOT NULL DEFAULT 'ABIERTA',
    `reportadaEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resueltaEn` DATETIME(3) NULL,

    INDEX `incidencias_salaId_idx`(`salaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `configuracion` (
    `clave` VARCHAR(50) NOT NULL,
    `valor` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `salas` ADD CONSTRAINT `salas_tipoSalaId_fkey` FOREIGN KEY (`tipoSalaId`) REFERENCES `tipos_sala`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salas` ADD CONSTRAINT `salas_tematicaId_fkey` FOREIGN KEY (`tematicaId`) REFERENCES `tematicas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sesiones` ADD CONSTRAINT `sesiones_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sesiones` ADD CONSTRAINT `sesiones_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservaciones` ADD CONSTRAINT `reservaciones_clienteId_fkey` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservaciones` ADD CONSTRAINT `reservaciones_salaId_fkey` FOREIGN KEY (`salaId`) REFERENCES `salas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservaciones` ADD CONSTRAINT `reservaciones_promocionId_fkey` FOREIGN KEY (`promocionId`) REFERENCES `promociones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservaciones` ADD CONSTRAINT `reservaciones_creadaPorId_fkey` FOREIGN KEY (`creadaPorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagos` ADD CONSTRAINT `pagos_reservacionId_fkey` FOREIGN KEY (`reservacionId`) REFERENCES `reservaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagos` ADD CONSTRAINT `pagos_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `pedidos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cancelaciones` ADD CONSTRAINT `cancelaciones_reservacionId_fkey` FOREIGN KEY (`reservacionId`) REFERENCES `reservaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reagendaciones` ADD CONSTRAINT `reagendaciones_reservacionId_fkey` FOREIGN KEY (`reservacionId`) REFERENCES `reservaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `extensiones` ADD CONSTRAINT `extensiones_reservacionId_fkey` FOREIGN KEY (`reservacionId`) REFERENCES `reservaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cuentas` ADD CONSTRAINT `cuentas_reservacionId_fkey` FOREIGN KEY (`reservacionId`) REFERENCES `reservaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedidos` ADD CONSTRAINT `pedidos_reservacionId_fkey` FOREIGN KEY (`reservacionId`) REFERENCES `reservaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedidos` ADD CONSTRAINT `pedidos_atendidoPorId_fkey` FOREIGN KEY (`atendidoPorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedido_items` ADD CONSTRAINT `pedido_items_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `pedidos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedido_items` ADD CONSTRAINT `pedido_items_productoId_fkey` FOREIGN KEY (`productoId`) REFERENCES `productos_menu`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `limpiezas` ADD CONSTRAINT `limpiezas_salaId_fkey` FOREIGN KEY (`salaId`) REFERENCES `salas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `limpiezas` ADD CONSTRAINT `limpiezas_reservacionId_fkey` FOREIGN KEY (`reservacionId`) REFERENCES `reservaciones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `limpiezas` ADD CONSTRAINT `limpiezas_realizadaPorId_fkey` FOREIGN KEY (`realizadaPorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incidencias` ADD CONSTRAINT `incidencias_salaId_fkey` FOREIGN KEY (`salaId`) REFERENCES `salas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
