# Reloj MA 32-2 — Electrónica

Repositorio de diseño del **Reloj Multi Alarma MA 32-2** de **Galeras Digital**: un temporizador
programable para timbres escolares construido alrededor de un microcontrolador PIC16F877A.
Contiene el firmware en ensamblador, los esquemáticos y PCB, los planos de la caja metálica,
el manual de usuario, el folleto comercial y los archivos de producción.

![Reloj MA 32-2](Manual/figuras/principal%201000p.png)

## Simulador web 3D

La aplicación en [`simulator/`](simulator/) permite operar el reloj con su teclado original,
programar los cuatro horarios, acelerar el tiempo y retirar la tapa para inspeccionar los
circuitos. Usa el modelo 3D original de ARES, las medidas de la caja, las fotografías y una
implementación funcional basada en el ensamblador.

```bash
cd simulator
npm ci
npm run dev
```

Incluye importación/exportación de EEPROM `.MCH`, protección por contraseña, respaldo de hora,
contacto de potencia, fusible y sonido opcional. Consulte el [README del simulador](simulator/README.md)
y las [notas de fidelidad](simulator/docs/FIDELITY.md) para las fuentes, pruebas, detalles inferidos
y diferencias frente a una emulación del PIC a nivel de instrucciones.

El logotipo del menú LCD reproduce exactamente los 48 bytes de `LCD_DIBLOGORET`: seis
caracteres de 5 × 8 píxeles en las últimas seis posiciones de la primera línea, tanto
en la pantalla 3D como en el panel de controles.

Para generar la versión de producción y ejecutar las pruebas:

```bash
npm run build   # Archivos estáticos en simulator/dist/
npm test       # Pruebas de firmware, EEPROM y bitmap del logotipo
npm run test:e2e # Pruebas de interacción en navegador
```

El [despliegue como servicio](simulator/deploy/README.md) usa HTTPS, renovación automática
del certificado, inicio al arrancar el servidor y acceso mediante un enlace privado
aleatorio. La dirección del servidor y el enlace de acceso se configuran fuera del
repositorio. La guía incluye actualización, reversión y revocación del enlace.

## Descripción del producto

El Reloj MA 32-2 es un dispositivo electrónico con reloj calendario que activa un timbre,
chicharra, alarma u otro equipo similar según un horario programado y durante un tiempo
configurable. Fue diseñado para establecimientos educativos que marcan el cambio de clase con
timbre, de modo que la programación se realiza una sola vez y el equipo se encarga del resto.

Los equipos han estado en funcionamiento en instituciones educativas de la ciudad de Pasto
(Colombia), entre ellas el Colegio Ciudad de Pasto, INEM, Liceo Central de Nariño, Normal
Superior y Heraldo Romero.

### Características principales

| Característica | Detalle |
|---|---|
| Horarios | 4 tipos de horario independientes, asignables a cada día de la semana (o ninguno, OFF) |
| Alarmas | 30 alarmas por horario (120 en total), cada una con estado ON/OFF |
| Tipos de timbrado | 1TC (1 timbre corto), 1TL (1 timbre largo), 2TC (2 cortos), 3TC (3 cortos) |
| Duración de timbres | Duración del timbre corto (TC) y largo (TL) configurables en segundos |
| Contacto de potencia | 15 A máx. a 100–240 VAC (1800 W / 3600 W), protegido con fusible de 15 A |
| Alimentación | 12 VDC, 500 mA máx. (adaptador externo 100–240 VAC, ~1 W) |
| Respaldo de hora | Pila CR2032 para el reloj de tiempo real (~10 años) |
| Memoria | EEPROM interna del PIC; la configuración no se pierde sin energía |
| Pantalla | LCD 16×2 retroiluminado; muestra la hora actual y el próximo timbre |
| Teclado | Matricial 4×4: números 0–9, Enter, ↑, ↓, Menú (M), `*` luz de fondo, `#` timbrado manual |
| Seguridad | Contraseña de 4 dígitos opcional para acceder al menú |
| Interruptor superior | Habilita o inhabilita el timbrado automático (días festivos) |
| Precisión | Basada en el reloj de tiempo real DS1307 con cristal de 32.768 kHz |

### Menú de configuración

Se accede con la tecla **M** y se navega con **↑ / ↓** y **Enter**:

- **Fijar Reloj**: hora, minutos, segundos, AM/PM y día de la semana.
- **Fijar Alarmas**: para cada horario (H1–H4), cada alarma 01–30 con hora, AM/PM, tipo de timbrado y estado ON/OFF.
- **Tipo de Horario**: horario (1–4 u OFF) asignado a cada día de la semana.
- **Contraseña**: activar/desactivar y definir la clave de 4 dígitos.
- **Dura. Timbres**: duración en segundos del timbre corto y del timbre largo.

Si se olvida la contraseña, se retira la pila CR2032 durante al menos 10 segundos: el firmware
detecta el bit CH del DS1307, realiza la carga inicial y deshabilita la contraseña.

El manual de usuario completo está en `Manual/manual.pdf` y el folleto comercial en
`Folleto/folleto_reloj_ma32-2.pdf`.

## Hardware

| Bloque | Componente | Notas |
|---|---|---|
| Microcontrolador | PIC16F877A | Cristal de 4 MHz (oscilador XT), WDT activado, protección de código |
| Reloj de tiempo real | DS1307 | Bus I²C por software (SCL = RA3, SDA = RA4), cristal 32.768 kHz, pila CR2032 |
| Base de tiempo | Salida SQW del DS1307 a 1 Hz | Conectada a RB0/INT; genera la interrupción que actualiza la pantalla |
| Pantalla | LCD 16×2 compatible LM016L | Modo 4 bits en PORTD: RS = RD1, R/W = RD2, E = RD3, datos RD4–RD7 |
| Luz de fondo | Transistor desde RC1 | Se apaga 10 s después de la última tecla |
| Teclado | Matricial hexadecimal 4×4 | Filas en RA0, RB1, RB2 y RB3; columnas en RB4–RB7 con interrupción por cambio de estado |
| Salida de timbre | RC0 → 2N2222 → relé 12 V / 40 A | Contacto protegido con fusible de 15 A |
| Regulación | 7805 | Entrada 12 VDC |
| Caja | Metálica ref. C57 | Planos en `Caja/` |

Los directorios `Circuitos/Potencia prototipo1` y `Circuitos/moc con boton` contienen prototipos
de la etapa de potencia con optotriac MOC30xx, previos a la versión con relé.

## Firmware

### Organización

- `relojma.asm`: programa principal (menús, reloj, comparación y disparo de alarmas).
- `Librerias/`: rutinas reutilizables incluidas desde el programa principal.

| Librería | Función |
|---|---|
| `TECLADO.INC` | Lectura del teclado matricial 4×4 con tabla de conversión |
| `LCD_4BITOPD877.INC` | Control del LCD en modo 4 bits sobre PORTD |
| `RETARDOS.INC` | Retardos calibrados para 4 MHz (de 4 µs a 20 s) |
| `BUS_I2C.INC` | Maestro I²C por software |
| `DS1307.INC` | Lectura/escritura del reloj calendario DS1307 |
| `EEPROM.INC` | Lectura y escritura de la EEPROM interna del PIC |
| `BINAD99.INC` | Conversión binario a BCD (0–99) |
| `CONTRASENA.INC` | Vacía (la lógica de contraseña está en el programa principal) |

Las librerías de teclado, LCD, retardos, I²C y DS1307 provienen del libro
*Microcontrolador PIC16F84. Desarrollo de proyectos* (E. Palacios, F. Remiro y L. López,
Ed. Ra-Ma), adaptadas al PIC16F877A. `BINAD99.INC` procede del proyecto de grado de Juan Pablo
Ruiz Rosero (Ingeniería Electrónica, Universidad de Nariño, 2008).

### Funcionamiento

El bucle principal ejecuta `SLEEP`; todo el trabajo ocurre en la rutina de interrupción:

- **INT (RB0)**: cada flanco de la señal de 1 Hz del DS1307. El firmware alterna el flanco
  activo para despertar cada 500 ms, lee la hora por I²C, refresca la pantalla (con los dos
  puntos fijos en esta revisión), descuenta el temporizador de la luz de fondo y comprueba si la alarma
  más cercana coincide con la hora actual. Si coincide, cierra el contacto según el tipo de
  timbrado y recalcula la siguiente alarma (`COMPALARMAS`).
- **RBIF (RB4–RB7)**: pulsación de tecla. `M` entra al menú (pidiendo contraseña si está
  activa), `#` cierra el contacto mientras se mantiene pulsada y `*` enciende la luz de fondo.

Patrones de timbrado (TC y TL son las duraciones configuradas en segundos):

| Tipo | Secuencia del contacto |
|---|---|
| 1TC | cerrado TC s |
| 1TL | cerrado TL s |
| 2TC | cerrado TC s, pausa 1 s, cerrado TC s |
| 3TC | cerrado TC s, pausa 1 s, cerrado TC s, pausa 1 s, cerrado TC s |

### Mapa de la EEPROM interna (256 bytes)

| Dirección | Contenido |
|---|---|
| `0x02`–`0xF1` | 120 alarmas de 2 bytes. Alarma *N* (1–30) del horario *H* (1–4) en `2 × (N + 30 × (H − 1))` |
| `0xF2`–`0xF8` | Tipo de horario de lunes a domingo (0 = OFF, 1–4) |
| `0xFB` | Duración del timbre corto menos uno (0–15 representa 1–16 segundos) |
| `0xFC` | Duración del timbre largo menos uno (0–15 representa 1–16 segundos) |
| `0xFD` | Bit 0: contraseña habilitada |
| `0xFE`–`0xFF` | Contraseña de 4 dígitos (2 bytes BCD) |

Formato de cada alarma:

- **Byte 0**: bits 7–6 tipo de timbrado (`00` 1TC, `01` 1TL, `10` 2TC, `11` 3TC); bits 5–0 hora en BCD (formato 24 h).
- **Byte 1**: bit 7 estado (1 = ON); bits 6–0 minutos en BCD.

### Memoria de programa

El código ocupa las páginas 0 y 1 del PIC (2675 de 8454 palabras, 31 %). La página 0 contiene el
programa principal, la página 1 (`0x900`) los menús de configuración y `COMPALARMAS`, y en
`0xE01` se ubica el logotipo que se carga en la CGRAM al arrancar y se muestra en el menú. El código comprueba con
directivas `ERROR` que ninguna sección invada la siguiente.

### Compilación

El proyecto se ensambla con **MPLAB IDE 8.x / MPASM** (última compilación con MPASM 5.42 el
28 de septiembre de 2014):

- `relojmaws.mcw`: espacio de trabajo de MPLAB.
- `relojma.mcs`: proyecto de MPLAB.
- `relojma.HEX`: firmware listo para grabar en el PIC16F877A.
- `relojma.cof`, `relojma.lst`, `relojma.map`, `relojma.O`, `relojma.err`: salidas del ensamblador.

Bits de configuración:

```
__CONFIG _CP_ALL & _WDT_ON & _BODEN_ON & _PWRTE_ON & _XT_OSC & _LVP_OFF & _CPD_OFF
```

Los `INCLUDE` usan rutas con barra invertida (`Librerias\...`), por lo que el ensamblado está
pensado para Windows. El archivo `.err` solo contiene mensajes 302/306 (bancos y páginas), sin
errores. La versión mostrada en pantalla por el firmware es `V:06/12`.

### Volcados de EEPROM (`*.MCH`)

Los archivos `.MCH` son exportaciones de la memoria EEPROM desde MPLAB (un byte hexadecimal por
línea) con configuraciones de alarmas reales y de prueba. Sirven para cargar de una vez la
programación de una institución al grabar el PIC:

- `heraldoromero.MCH`, `timbresinem.MCH`: configuraciones de instituciones educativas.
- `alarmaccp.MCH`, `pruebasyccp.MCH`, `alarmas1.MCH`, `memoria1.MCH`: otras configuraciones.
- `prueba30min.MCH`, `pruebaseguida.MCH`: configuraciones de prueba.
- `alarmas1.TXT`, `eeprom.bin`: volcados equivalentes en otros formatos.

## Estructura del repositorio

```
.
├── relojma.asm               Firmware principal (PIC16F877A, ensamblador MPASM)
├── relojma.HEX               Firmware compilado
├── relojmaws.mcw / relojma.mcs   Espacio de trabajo y proyecto de MPLAB
├── relojma.DSN / relojma2.DSN    Esquemático de simulación en Proteus ISIS
├── *.MCH, alarmas1.TXT, eeprom.bin   Volcados de EEPROM con configuraciones de alarmas
├── Librerias/                Librerías en ensamblador (teclado, LCD, I2C, DS1307, EEPROM, retardos)
├── Circuitos/                Esquemáticos y PCB en Proteus (ISIS .DSN / ARES .LYT)
│   ├── PCBMICRO/             Gerbers de la primera placa (febrero de 2009)
│   ├── Version 2/            Placa versión 2 (diciembre de 2013), PDF y modelo 3D (.3DS)
│   ├── Potencia prototipo1.* Prototipo de etapa de potencia con optotriac
│   └── moc con boton.*       Prueba de optotriac MOC30xx con pulsador
├── Caja/                     Planos de la caja metálica
│   ├── frente.dxf, inferior.dxf, conectores.dxf   Cortes y perforaciones (abrir con QCAD)
│   ├── cauchos*.svg, huecos abajosvg.*             Plantillas de cauchos y perforaciones
│   ├── medidas.ods           Cotas en milímetros de LCD, teclado, PCB y conectores
│   ├── especificaciones.svg  Etiqueta de especificaciones (versión antigua, 32 alarmas / 2 horarios)
│   ├── Teclado/              Marco de teclas y flechas (CorelDRAW, SVG)
│   └── Antiguas medidas/     Planos de la versión anterior
├── Manual/                   Manual de usuario en LaTeX (manual.tex → manual.pdf)
│   ├── figuras/              Figuras EPS/SVG/PDF del manual
│   ├── fuentes/              Tipografía de la pantalla LCD
│   └── Antiguo/              Versión anterior del manual
├── Folleto/                  Folleto comercial en LaTeX (folleto.tex → folleto_reloj_ma32-2.pdf)
│   ├── partes/               Imágenes del folleto
│   ├── Fotos/                Fotografías del equipo (junio de 2012)
│   └── resolucion.sh         Compresión del PDF con Ghostscript
├── Otros/
│   ├── relojma_conilcd2.asm  Variante del firmware que reinicializa el LCD periódicamente
│   ├── etiqueta.svg, etiquetas mosaico.*   Etiqueta del producto y hoja para imprimir
│   └── Materiales Fabricación.ods          Lista de materiales con costos y proveedores
└── Pagina/                   Imágenes para la página web
```

## Documentación

El manual y el folleto están escritos en LaTeX con figuras EPS, por lo que se compilan con la
cadena `latex → dvips → ps2pdf`:

```bash
cd Manual
latex manual.tex && latex manual.tex   # dos pasadas para el índice
dvips manual.dvi -o manual.ps
ps2pdf manual.ps manual.pdf
```

El folleto se compila de la misma forma dentro de `Folleto/`. El script `Folleto/resolucion.sh`
reduce el tamaño del PDF con Ghostscript.

## Herramientas utilizadas

| Área | Herramienta |
|---|---|
| Firmware | MPLAB IDE 8.x, MPASM 5.42 |
| Esquemáticos y PCB | Proteus ISIS / ARES (archivos `.DSN`, `.LYT`, Gerber RS-274X) |
| Caja | QCAD (DXF), Inkscape (SVG), CorelDRAW (CDR), LibreOffice Calc (ODS) |
| Documentación | LaTeX (KOMA-Script `scrbook`, babel español), dvips, Ghostscript |

## Historia del diseño

- **2008**: primeras compras de componentes y pruebas con optotriacs y contactores.
- **Febrero de 2009**: Gerbers de la primera placa, fabricada por PCB Microcircuitos.
- **2009**: volcados de EEPROM de las primeras instalaciones en colegios de Pasto.
- **Junio de 2012**: versión de firmware `06/12` (30 alarmas × 4 horarios), fotografías y folleto.
- **Diciembre de 2013**: placa versión 2 con modelo 3D.
- **Septiembre/octubre de 2014**: última compilación del firmware y manual versión 3.03.

El nombre **MA 32-2** proviene de la versión original del producto (32 alarmas, doble horario),
como indica la etiqueta antigua en `Caja/especificaciones.svg`. La versión actual del firmware
ofrece 4 horarios de 30 alarmas cada uno.


## Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Consulte el archivo [`LICENSE`](LICENSE)
para el texto completo.

Las librerías `TECLADO.INC`, `LCD_4BITOPD877.INC`, `RETARDOS.INC`, `BUS_I2C.INC` y
`DS1307.INC` derivan del libro *Microcontrolador PIC16F84. Desarrollo de proyectos*
(E. Palacios, F. Remiro y L. López, Ed. Ra-Ma) y conservan los derechos de sus autores
originales.
