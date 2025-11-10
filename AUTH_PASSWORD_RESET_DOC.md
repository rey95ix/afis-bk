# Documentación de Módulo de Autenticación - Recuperación y Cambio de Contraseña

Este documento detalla las nuevas funcionalidades implementadas en el módulo de autenticación del backend de AFIS, específicamente para la recuperación y cambio de contraseñas. Está dirigido a desarrolladores frontend para facilitar la integración.

## 1. Introducción

Se han añadido endpoints para permitir a los usuarios:
*   Solicitar un restablecimiento de contraseña si la han olvidado.
*   Restablecer su contraseña utilizando un token de recuperación.
*   Cambiar su contraseña actual una vez autenticados.

## 2. Flujo de Proceso: Olvidé/Restablecer Contraseña

El proceso para que un usuario restablezca su contraseña es el siguiente:

1.  **Usuario solicita restablecimiento:** El usuario ingresa su dirección de correo electrónico en el frontend y envía una solicitud al backend.
2.  **Backend procesa solicitud:**
    *   Verifica que el correo electrónico exista en la base de datos.
    *   Genera un token único de restablecimiento de contraseña.
    *   Almacena el hash de este token y su fecha de expiración (30 minutos) en el registro del usuario en la base de datos.
    *   Envía un correo electrónico al usuario con un enlace que contiene el token de restablecimiento.
3.  **Usuario recibe correo y hace clic en el enlace:** El usuario abre el correo electrónico y hace clic en el enlace proporcionado. Este enlace debe dirigir a una ruta específica en el frontend (ej. `/auth/reset-password?token=XYZ`).
4.  **Frontend maneja el enlace de restablecimiento:**
    *   La aplicación frontend debe capturar el token de la URL.
    *   Presenta al usuario un formulario para ingresar su nueva contraseña.
5.  **Usuario envía nueva contraseña:** El usuario ingresa y confirma su nueva contraseña en el formulario del frontend, y la envía al backend junto con el token.
6.  **Backend restablece la contraseña:**
    *   Valida el token recibido (que no haya expirado y que coincida con el almacenado).
    *   Actualiza la contraseña del usuario con la nueva contraseña proporcionada (previamente hasheada).
    *   Invalida el token de restablecimiento en la base de datos.

## 3. Endpoints de la API

A continuación, se detallan los nuevos endpoints disponibles:

### 3.1. `POST /auth/forgot-password`

*   **Descripción:** Inicia el proceso de recuperación de contraseña. El backend enviará un correo electrónico al usuario con un enlace para restablecer su contraseña si el correo existe en el sistema.
*   **Request Body:**
    ```typescript
    // ForgotPasswordDto
    interface ForgotPasswordDto {
      email: string; // La dirección de correo electrónico del usuario
    }
    ```
*   **Ejemplo de Request:**
    ```json
    {
      "email": "usuario@example.com"
    }
    ```
*   **Respuestas:**
    *   `200 OK`: `{"message": "Si el correo existe, se ha enviado un enlace de restablecimiento."}` (Se envía un mensaje genérico por seguridad, independientemente de si el correo existe o no).
    *   `400 Bad Request`: Si el formato del correo electrónico es inválido.
    *   `500 Internal Server Error`: Si hay un problema al enviar el correo electrónico o al procesar la solicitud.

### 3.2. `POST /auth/reset-password`

*   **Descripción:** Permite al usuario establecer una nueva contraseña utilizando un token de restablecimiento válido.
*   **Request Body:**
    ```typescript
    // ResetPasswordDto
    interface ResetPasswordDto {
      token: string;    // El token de restablecimiento recibido por correo
      password: string; // La nueva contraseña (debe cumplir con los requisitos de seguridad)
    }
    ```
*   **Requisitos de Contraseña:**
    *   Mínimo 8 caracteres.
    *   Al menos una letra mayúscula.
    *   Al menos una letra minúscula.
    *   Al menos un número.
*   **Ejemplo de Request:**
    ```json
    {
      "token": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
      "password": "NuevaPassword123"
    }
    ```
*   **Respuestas:**
    *   `200 OK`: `{"message": "Contraseña restablecida exitosamente."}`
    *   `400 Bad Request`: Si el token es inválido/expirado o la nueva contraseña no cumple con los requisitos.
    *   `404 Not Found`: Si el token no se encuentra o ya fue utilizado.
    *   `500 Internal Server Error`: Si ocurre un error inesperado.

### 3.3. `PATCH /auth/change-password`

*   **Descripción:** Permite a un usuario autenticado cambiar su contraseña actual.
*   **Autenticación:** Requiere un JWT válido en el encabezado `Authorization` (Bearer Token).
*   **Request Body:**
    ```typescript
    // ChangePasswordDto
    interface ChangePasswordDto {
      oldPassword: string; // La contraseña actual del usuario
      newPassword: string; // La nueva contraseña (debe cumplir con los requisitos de seguridad)
    }
    ```
*   **Requisitos de Contraseña:**
    *   Mínimo 8 caracteres.
    *   Al menos una letra mayúscula.
    *   Al menos una letra minúscula.
    *   Al menos un número.
*   **Ejemplo de Request:**
    ```json
    {
      "oldPassword": "ContraseñaActual123",
      "newPassword": "NuevaContraseña456"
    }
    ```
*   **Respuestas:**
    *   `200 OK`: `{"message": "Contraseña cambiada exitosamente."}`
    *   `401 Unauthorized`: Si la contraseña actual es incorrecta o el token JWT es inválido/ausente.
    *   `400 Bad Request`: Si la nueva contraseña no cumple con los requisitos.
    *   `404 Not Found`: Si el usuario no es encontrado (aunque esto debería ser manejado por el guard de autenticación).
    *   `500 Internal Server Error`: Si ocurre un error inesperado.

## 4. Notas para la Integración Frontend

*   **URL de Restablecimiento:** La URL que se envía en el correo electrónico de restablecimiento de contraseña se construye utilizando la variable de entorno `FRONTEND_URL`. Asegúrate de que esta variable esté configurada correctamente en el backend para que los enlaces sean válidos.
*   **Extracción del Token:** En el frontend, cuando el usuario acceda a la ruta de restablecimiento de contraseña (ej. `/auth/reset-password?token=XYZ`), deberás extraer el valor del parámetro `token` de la URL para enviarlo en la solicitud `POST /auth/reset-password`.
*   **Manejo de Errores:** Implementa un manejo robusto de errores para informar al usuario sobre problemas como tokens inválidos/expirados, contraseñas que no cumplen los requisitos, o fallos en el envío de correos.
*   **Seguridad:** Asegúrate de que las contraseñas se manejen de forma segura en el frontend (ej. no almacenarlas en el almacenamiento local, limpiar campos después de su uso).

---
**Fin del Documento**
