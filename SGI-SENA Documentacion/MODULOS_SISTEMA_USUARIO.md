# Módulos del Sistema SGE-SENA — Guía para el Usuario

**Sistema de Gestión de Equipos Tecnológicos y Mobiliarios del SENA**

Este documento describe los módulos disponibles en el sistema desde el punto de vista del usuario: qué hace cada uno, para qué sirve y qué puede esperar al usarlo. No incluye detalles técnicos ni código.

---

## Índice

1. [Inicio (Dashboard)](#1-inicio-dashboard)
2. [Inventario (Equipos)](#2-inventario-equipos)
3. [Incidencias y Reportes](#3-incidencias-y-reportes)
4. [Mantenimiento](#4-mantenimiento)
5. [Horarios y Clases](#5-horarios-y-clases)
6. [Configuración y Usuarios](#6-configuración-y-usuarios)
7. [Perfil y Seguridad](#7-perfil-y-seguridad)
8. [Acceso según su rol](#8-acceso-según-su-rol)

---

## 1. Inicio (Dashboard)

**Qué es:** La pantalla principal después de iniciar sesión.

**Para qué sirve:** Ofrece un resumen rápido del estado del sistema: cantidad de equipos, novedades pendientes, mantenimientos próximos y otras cifras relevantes. También permite acceder con un clic a las acciones más usadas (consultar inventario, mis equipos, crear novedad, etc.).

**Qué puede hacer:** Ver las estadísticas (según su rol), usar los accesos directos y estar al tanto de la actividad reciente. Las estadísticas se actualizan en tiempo real cuando ocurren cambios en el sistema.

---

## 2. Inventario (Equipos)

Este módulo agrupa todo lo relacionado con el registro, consulta, asignación y verificación de equipos tecnológicos y mobiliarios.

### 2.1 Registrar Inventario

**Qué es:** La pantalla donde se da de alta nuevo equipo en el sistema.

**Para qué sirve:** Permite registrar equipos tecnológicos o mobiliarios con datos como código, tipo, marca, estado, ubicación y, si aplica, imágenes. También permite cargar varios equipos a la vez mediante importación desde archivo.

**Quién lo usa:** Administradores y cuentadantes.

---

### 2.2 Consultar Inventario

**Qué es:** La pantalla para buscar y ver el listado de equipos registrados.

**Para qué sirve:** Permite buscar equipos por código, tipo, estado u otros criterios, ver el listado y acceder al detalle de cada equipo (incluyendo historial de verificaciones).

**Quién lo usa:** Todos los usuarios según permisos.

---

### 2.3 Mis Equipos

**Qué es:** La vista de los equipos que tiene asignados el usuario que inició sesión.

**Para qué sirve:** Ver de forma rápida qué equipos tiene asignados (como aprendiz o responsable) y acceder a su detalle o a reportar novedades sobre ellos.

**Quién lo usa:** Todos los usuarios que tengan equipos asignados.

---

### 2.4 Asignar Equipo

**Qué es:** La pantalla para asignar equipos a personas (aprendices, instructores, etc.) y para ver o gestionar las asignaciones existentes.

**Para qué sirve:** Asignar un equipo a un usuario, quitar asignaciones o consultar quién tiene qué equipo asignado. Centraliza la gestión de “quién es responsable de qué equipo”.

**Quién lo usa:** Administradores, instructores y cuentadantes (según permisos).

---

### 2.5 Verificar Inventario

**Qué es:** La pantalla para realizar verificaciones físicas del inventario.

**Para qué sirve:** Confirmar que los equipos existen, están en el lugar indicado y en el estado registrado. Las verificaciones quedan registradas y se pueden consultar en el historial del equipo.

**Quién lo usa:** Instructores y cuentadantes (y otros roles según configuración).

---

### 2.6 Buscar Cuentadante

**Qué es:** Una herramienta para localizar al cuentadante responsable de un equipo o ambiente.

**Para qué sirve:** Cuando se necesita saber quién responde por un equipo o un ambiente, esta búsqueda permite encontrar al cuentadante asignado.

**Quién lo usa:** Administradores.

---

### 2.7 Gestión de Ambientes

**Qué es:** La pantalla para administrar los ambientes o espacios (aulas, talleres, oficinas, etc.) donde están los equipos.

**Para qué sirve:** Crear, editar y dar de baja ambientes; asociar equipos a ambientes y tener un inventario por ubicación física.

**Quién lo usa:** Administradores.

---

### 2.8 Asignar Ambientes

**Qué es:** La pantalla para asignar instructores o cuentadantes a los ambientes.

**Para qué sirve:** Definir qué instructor o cuentadante queda asignado a cada ambiente, de modo que quede claro quién responde por el inventario de ese espacio y quién da clase o está a cargo del mismo.

**Quién lo usa:** Administradores.

---

## 3. Incidencias y Reportes

Este módulo reúne las novedades (incidencias sobre equipos) y los reportes de uso o situación.

### 3.1 Novedades

**Qué es:** El listado y la gestión de novedades o incidencias relacionadas con los equipos (averías, faltantes, daños, observaciones, etc.).

**Para qué sirve:** Ver todas las novedades (o las que le correspondan según su rol), filtrar por estado o tipo, cambiar el estado (por ejemplo, de “pendiente” a “resuelta”), agregar observaciones de resolución y, en algunos casos, exportar o imprimir.

**Quién lo usa:** Administradores, instructores y cuentadantes (con permisos distintos según el rol).

---

### 3.2 Crear Novedad

**Qué es:** El formulario para registrar una nueva incidencia sobre un equipo.

**Para qué sirve:** Indicar el equipo (por código), el tipo de novedad y la descripción. El sistema valida que el equipo exista y permite enviar la novedad para que sea atendida.

**Quién lo usa:** Usuarios con permiso para crear novedades (administradores, instructores, cuentadantes, y en algunos casos aprendices en sus equipos asignados).

---

### 3.3 Reportes

**Qué es:** Los reportes de uso o informes sobre los equipos (uso, estado, incidencias, etc.).

**Para qué sirve:** Crear reportes asociados a un equipo o de tipo general, ver el listado de reportes existentes, editarlos o consultarlos. Complementa las novedades con información más estructurada o periódica.

**Quién lo usa:** Según permisos (administradores, instructores, cuentadantes y aprendices pueden tener acceso a ver y/o crear reportes).

---

## 4. Mantenimiento

**Qué es:** El módulo de historial y gestión de mantenimientos de los equipos.

**Para qué sirve:** Ver el historial de mantenimientos (preventivos, correctivos, etc.) de los equipos, programar nuevos mantenimientos y consultar fechas, estados y observaciones. Permite llevar un registro ordenado de qué se ha reparado o revisado y cuándo.

**Quién lo usa:** Administradores y cuentadantes (y otros roles según configuración).

---

## 5. Horarios y Clases

**Qué es:** El módulo relacionado con horarios y, en su caso, con clases o uso programado de ambientes/equipos.

**Para qué sirve:** Para instructores y cuentadantes (ambos dan clases): ver “mis horarios” y la información de clases o responsabilidades asignadas. Para administradores: gestionar horarios y la asignación de responsables en los distintos bloques horarios o ambientes.

**Quién lo usa:** Instructores y cuentadantes (consulta de sus horarios) y administradores (gestión de horarios).

---

## 6. Configuración y Usuarios

Este módulo agrupa la administración de usuarios, aprendices y parámetros del sistema. Se accede desde el menú “Configuración / Usuarios” y, en parte, desde la pantalla **Configuración** (ajustes por sección).

### 6.1 Usuarios

**Qué es:** La pantalla para gestionar los usuarios del sistema (instructores, administradores, cuentadantes, etc.).

**Para qué sirve:** Ver el listado de usuarios, crear nuevos usuarios, editar datos (nombre, correo, rol, etc.) y, según permisos, activar o desactivar cuentas. No aplica a aprendices; estos se gestionan en “Aprendices”.

**Quién lo usa:** Administradores, instructores y cuentadantes (instructores y cuentadantes suelen tener solo consulta).

---

### 6.2 Aprendices

**Qué es:** La pantalla para gestionar aprendices (usuarios con rol Aprendiz).

**Para qué sirve:** Ver el listado de aprendices, dar de alta nuevos aprendices y editar su información. Suele usarse para mantener actualizada la base de quienes pueden tener equipos asignados.

**Quién lo usa:** Administradores.

---

### 6.3 Códigos de Seguridad (Códigos de Invitación)

**Qué es:** La sección dentro de Configuración donde se gestionan los códigos de invitación o registro.

**Para qué sirve:** Generar códigos para que nuevas personas se registren en el sistema de forma controlada. Permite limitar quién puede crear una cuenta y asociar el registro a un rol o área según la política del centro.

**Quién lo usa:** Administradores.

---

### 6.4 Tipos de Equipos

**Qué es:** La sección donde se definen los tipos de equipo (portátil, monitor, mesa, etc.).

**Para qué sirve:** Mantener un catálogo de tipos para que al registrar o consultar equipos se elija siempre de una lista coherente. Evita nombres dispares y facilita reportes y filtros.

**Quién lo usa:** Administradores.

---

### 6.5 Roles y Áreas

**Qué es:** La sección donde se consultan (y en algunos casos se configuran) los roles y áreas del centro.

**Para qué sirve:** Entender qué roles existen (Administrador, Instructor, Aprendiz, Cuentadante, etc.) y qué áreas hay. Según permisos, permite ajustar nombres o opciones visibles para el usuario.

**Quién lo usa:** Todos pueden ver algo de esta sección; la edición suele estar restringida a administradores.

---

### 6.6 Notificaciones

**Qué es:** La sección donde se configuran y consultan las notificaciones del sistema.

**Para qué sirve:** Activar o desactivar notificaciones (por correo, en la aplicación, etc.), ver el historial de notificaciones recibidas y, en el caso de administradores, enviar o programar avisos a otros usuarios.

**Quién lo usa:** Todos los usuarios (cada uno sus preferencias); administradores además pueden enviar notificaciones.

---

### 6.7 Ajustes de la App

**Qué es:** La sección de preferencias generales de la aplicación.

**Para qué sirve:** Ajustar opciones de visualización, idioma, tema o comportamiento de la interfaz según lo que ofrezca el sistema (por ejemplo, notificaciones en pantalla, densidad de listados, etc.).

**Quién lo usa:** Todos los usuarios.

---

## 7. Perfil y Seguridad

### 7.1 Perfil

**Qué es:** La pantalla con los datos personales del usuario que ha iniciado sesión.

**Para qué sirve:** Ver y editar nombre, correo, teléfono y documento. No permite cambiar el rol; eso lo hace un administrador desde “Usuarios” o “Aprendices”.

**Quién lo usa:** Todos los usuarios.

---

### 7.2 Seguridad (Cambio de contraseña)

**Qué es:** La sección dentro de Configuración para cambiar la contraseña de acceso.

**Para qué sirve:** Cambiar la contraseña actual por una nueva, normalmente pidiendo la contraseña actual y la nueva dos veces para confirmar.

**Quién lo usa:** Todos los usuarios.

---

### 7.3 Inicio de sesión, registro y recuperación de contraseña

**Qué es:** Las pantallas de acceso al sistema sin estar autenticado.

**Para qué sirve:**
- **Iniciar sesión:** Entrar con documento y contraseña.
- **Registrarse:** Crear una cuenta (si está habilitado), a veces con un código de invitación.
- **Olvidé mi contraseña / Restablecer contraseña:** Solicitar un enlace por correo para restablecer la contraseña y definir una nueva.

**Quién lo usa:** Cualquier persona que necesite acceder al sistema o recuperar su cuenta.

---

## 8. Acceso según su rol

El sistema limita qué pantallas y acciones ve cada usuario según su **rol**:

| Rol            | Resumen de acceso |
|----------------|-------------------|
| **Administrador** | Acceso completo: inventario, asignaciones, ambientes, usuarios, aprendices, novedades, mantenimientos, horarios, configuración (códigos, tipos de equipo, roles, notificaciones, ajustes). |
| **Instructor**  | Consulta de inventario y usuarios; asignación de equipos; verificación de inventario; novedades y reportes; ver mantenimientos; ver y gestionar sus horarios; secciones de configuración permitidas (por ejemplo Roles y Áreas, Notificaciones, Ajustes). No gestiona aprendices ni códigos de invitación. |
| **Cuentadante** | Mismas opciones que el instructor en lo docente (asignar equipos, verificar inventario, horarios y clases, ver usuarios, novedades y reportes). Además: registrar inventario y gestionar historial de mantenimientos. Los cuentadantes también dan clases, por eso comparten permisos con el instructor. |
| **Aprendiz**    | Ver su perfil; ver solo sus equipos asignados; crear novedades o reportes sobre sus equipos; ver mantenimientos de sus equipos; notificaciones y ajustes de la app. No accede a listados globales de equipos ni de usuarios. |

Las opciones que ve en el menú lateral dependen de su rol. Si no ve un módulo o una acción, es porque su rol no tiene permiso para ello; en ese caso debe contactar a un administrador.

---

*Documento orientado al usuario del SGE-SENA. Para detalles técnicos o de implementación, consulte el resto de la documentación del proyecto.*
