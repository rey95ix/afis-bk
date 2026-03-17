-- DropForeignKey
ALTER TABLE "ticket_soporte" DROP CONSTRAINT "ticket_soporte_id_direccion_servicio_fkey";

-- CreateTable
CREATE TABLE "olt_equipo" (
    "id_olt_equipo" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "ip_address" VARCHAR(50) NOT NULL,
    "id_sucursal" INTEGER,
    "legacy_id" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "olt_equipo_pkey" PRIMARY KEY ("id_olt_equipo")
);

-- CreateTable
CREATE TABLE "olt_marca" (
    "id_olt_marca" SERIAL NOT NULL,
    "nombre" VARCHAR(25) NOT NULL,
    "legacy_id" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "olt_marca_pkey" PRIMARY KEY ("id_olt_marca")
);

-- CreateTable
CREATE TABLE "olt_modelo" (
    "id_olt_modelo" SERIAL NOT NULL,
    "id_olt_marca" INTEGER NOT NULL,
    "nombre" VARCHAR(20) NOT NULL,
    "srvprofile_olt" VARCHAR(45),
    "legacy_id" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "olt_modelo_pkey" PRIMARY KEY ("id_olt_modelo")
);

-- CreateTable
CREATE TABLE "olt_tarjeta" (
    "id_olt_tarjeta" SERIAL NOT NULL,
    "id_olt_equipo" INTEGER NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "slot" INTEGER NOT NULL,
    "modelo" VARCHAR(50),
    "legacy_id" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "olt_tarjeta_pkey" PRIMARY KEY ("id_olt_tarjeta")
);

-- CreateTable
CREATE TABLE "olt_perfil_trafico" (
    "id_olt_perfil_trafico" SERIAL NOT NULL,
    "nombre" VARCHAR(30) NOT NULL,
    "cir" INTEGER NOT NULL,
    "cbs" INTEGER NOT NULL,
    "pir" INTEGER NOT NULL,
    "pbs" INTEGER NOT NULL,
    "legacy_id" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "olt_perfil_trafico_pkey" PRIMARY KEY ("id_olt_perfil_trafico")
);

-- CreateTable
CREATE TABLE "olt_red" (
    "id_olt_red" SERIAL NOT NULL,
    "network" VARCHAR(15) NOT NULL,
    "netmask" VARCHAR(15) NOT NULL,
    "cidr" INTEGER NOT NULL,
    "gateway" VARCHAR(15) NOT NULL,
    "pri_dns" VARCHAR(15),
    "slv_dns" VARCHAR(15),
    "proposito" VARCHAR(255),
    "legacy_id" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "olt_red_pkey" PRIMARY KEY ("id_olt_red")
);

-- CreateTable
CREATE TABLE "olt_cliente" (
    "id_olt_cliente" SERIAL NOT NULL,
    "id_cliente" INTEGER,
    "id_olt_tarjeta" INTEGER NOT NULL,
    "port" INTEGER NOT NULL,
    "ont" INTEGER NOT NULL,
    "ont_status" INTEGER NOT NULL DEFAULT 0,
    "serviceport" INTEGER NOT NULL,
    "serviceport_status" INTEGER NOT NULL DEFAULT 0,
    "id_olt_modelo" INTEGER,
    "sn" VARCHAR(30),
    "password" VARCHAR(15),
    "fecha_activacion" TIMESTAMP(3),
    "vlan" INTEGER,
    "user_vlan" INTEGER,
    "serviceport_tr069" INTEGER,
    "serviceport_iptv" INTEGER,
    "serviceport_voip" INTEGER,
    "legacy_id" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "olt_cliente_pkey" PRIMARY KEY ("id_olt_cliente")
);

-- CreateTable
CREATE TABLE "olt_cliente_ip" (
    "id_olt_cliente_ip" SERIAL NOT NULL,
    "id_cliente" INTEGER,
    "id_olt_red" INTEGER NOT NULL,
    "ip" VARCHAR(15) NOT NULL,
    "long_code" BIGINT,
    "selected_pri_dns" VARCHAR(15),
    "selected_slv_dns" VARCHAR(15),
    "is_reserved" BOOLEAN NOT NULL DEFAULT false,
    "legacy_id" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "olt_cliente_ip_pkey" PRIMARY KEY ("id_olt_cliente_ip")
);

-- CreateTable
CREATE TABLE "olt_cliente_telefono" (
    "id_olt_cliente_telefono" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "extension" VARCHAR(45),
    "telefono" VARCHAR(45),
    "usuario" VARCHAR(45),
    "password" VARCHAR(45),
    "legacy_id" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "olt_cliente_telefono_pkey" PRIMARY KEY ("id_olt_cliente_telefono")
);

-- CreateIndex
CREATE UNIQUE INDEX "olt_equipo_legacy_id_key" ON "olt_equipo"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "olt_marca_legacy_id_key" ON "olt_marca"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "olt_modelo_legacy_id_key" ON "olt_modelo"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "olt_tarjeta_legacy_id_key" ON "olt_tarjeta"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "olt_perfil_trafico_legacy_id_key" ON "olt_perfil_trafico"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "olt_red_legacy_id_key" ON "olt_red"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "olt_cliente_legacy_id_key" ON "olt_cliente"("legacy_id");

-- CreateIndex
CREATE INDEX "olt_cliente_id_cliente_idx" ON "olt_cliente"("id_cliente");

-- CreateIndex
CREATE INDEX "olt_cliente_serviceport_idx" ON "olt_cliente"("serviceport");

-- CreateIndex
CREATE UNIQUE INDEX "olt_cliente_ip_legacy_id_key" ON "olt_cliente_ip"("legacy_id");

-- CreateIndex
CREATE INDEX "olt_cliente_ip_id_cliente_idx" ON "olt_cliente_ip"("id_cliente");

-- CreateIndex
CREATE UNIQUE INDEX "olt_cliente_telefono_legacy_id_key" ON "olt_cliente_telefono"("legacy_id");

-- AddForeignKey
ALTER TABLE "ticket_soporte" ADD CONSTRAINT "ticket_soporte_id_direccion_servicio_fkey" FOREIGN KEY ("id_direccion_servicio") REFERENCES "clienteDirecciones"("id_cliente_direccion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_equipo" ADD CONSTRAINT "olt_equipo_id_sucursal_fkey" FOREIGN KEY ("id_sucursal") REFERENCES "sucursales"("id_sucursal") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_modelo" ADD CONSTRAINT "olt_modelo_id_olt_marca_fkey" FOREIGN KEY ("id_olt_marca") REFERENCES "olt_marca"("id_olt_marca") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_tarjeta" ADD CONSTRAINT "olt_tarjeta_id_olt_equipo_fkey" FOREIGN KEY ("id_olt_equipo") REFERENCES "olt_equipo"("id_olt_equipo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_cliente" ADD CONSTRAINT "olt_cliente_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_cliente" ADD CONSTRAINT "olt_cliente_id_olt_tarjeta_fkey" FOREIGN KEY ("id_olt_tarjeta") REFERENCES "olt_tarjeta"("id_olt_tarjeta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_cliente" ADD CONSTRAINT "olt_cliente_id_olt_modelo_fkey" FOREIGN KEY ("id_olt_modelo") REFERENCES "olt_modelo"("id_olt_modelo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_cliente_ip" ADD CONSTRAINT "olt_cliente_ip_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_cliente_ip" ADD CONSTRAINT "olt_cliente_ip_id_olt_red_fkey" FOREIGN KEY ("id_olt_red") REFERENCES "olt_red"("id_olt_red") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_cliente_telefono" ADD CONSTRAINT "olt_cliente_telefono_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "olt_credencial" (
    "id_olt_credencial" SERIAL NOT NULL,
    "id_olt_equipo" INTEGER NOT NULL,
    "ssh_usuario" VARCHAR(100) NOT NULL,
    "ssh_password" VARCHAR(255) NOT NULL,
    "ssh_puerto" INTEGER NOT NULL DEFAULT 22,
    "prompt_pattern" VARCHAR(100) NOT NULL DEFAULT 'OLT1-Newtel>',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "olt_credencial_pkey" PRIMARY KEY ("id_olt_credencial")
);

-- CreateTable
CREATE TABLE "olt_comando" (
    "id_olt_comando" SERIAL NOT NULL,
    "id_olt_equipo" INTEGER NOT NULL,
    "id_cliente" INTEGER,
    "tipo_operacion" VARCHAR(30) NOT NULL,
    "comando" TEXT NOT NULL,
    "estado" INTEGER NOT NULL DEFAULT 0,
    "respuesta" TEXT,
    "error_mensaje" TEXT,
    "id_usuario" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ejecutadoAt" TIMESTAMP(3),

    CONSTRAINT "olt_comando_pkey" PRIMARY KEY ("id_olt_comando")
);

-- CreateTable
CREATE TABLE "olt_cambio_equipo" (
    "id_olt_cambio_equipo" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "sn_anterior" VARCHAR(30),
    "sn_nuevo" VARCHAR(30),
    "password_anterior" VARCHAR(15),
    "password_nuevo" VARCHAR(15),
    "id_modelo_anterior" INTEGER,
    "id_modelo_nuevo" INTEGER,
    "observacion" TEXT,
    "id_usuario" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "olt_cambio_equipo_pkey" PRIMARY KEY ("id_olt_cambio_equipo")
);

-- CreateIndex
CREATE UNIQUE INDEX "olt_credencial_id_olt_equipo_key" ON "olt_credencial"("id_olt_equipo");

-- CreateIndex
CREATE INDEX "olt_comando_estado_idx" ON "olt_comando"("estado");

-- CreateIndex
CREATE INDEX "olt_comando_id_cliente_idx" ON "olt_comando"("id_cliente");

-- CreateIndex
CREATE INDEX "olt_cambio_equipo_id_cliente_idx" ON "olt_cambio_equipo"("id_cliente");

-- AddForeignKey
ALTER TABLE "olt_credencial" ADD CONSTRAINT "olt_credencial_id_olt_equipo_fkey" FOREIGN KEY ("id_olt_equipo") REFERENCES "olt_equipo"("id_olt_equipo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_comando" ADD CONSTRAINT "olt_comando_id_olt_equipo_fkey" FOREIGN KEY ("id_olt_equipo") REFERENCES "olt_equipo"("id_olt_equipo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_comando" ADD CONSTRAINT "olt_comando_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_comando" ADD CONSTRAINT "olt_comando_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_cambio_equipo" ADD CONSTRAINT "olt_cambio_equipo_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "olt_cambio_equipo" ADD CONSTRAINT "olt_cambio_equipo_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
