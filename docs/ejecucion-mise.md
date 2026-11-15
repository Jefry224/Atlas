# Guía de Ejecución y Replicación con `mise`

Esta guía detalla los pasos para configurar, replicar y ejecutar el entorno de desarrollo de **A.R.E.S. Twin** utilizando [`mise`](https://mise.jdx.dev/) en cualquier máquina (Windows, macOS o Linux).

---

## 1. Requisitos previos

* Tener instalado **`mise`**:
  * **Windows** (winget):
    ```powershell
    winget install jdx.mise
    ```
  * **macOS / Linux**:
    ```bash
    curl https://mise.run | sh
    ```
* Tener clonado el repositorio y estar ubicado en la raíz del proyecto:
  ```bash
  cd Atlas
  ```

---

## 2. Replicación del entorno paso a paso

### Paso 2.1: Instalar las herramientas con `mise`

Ejecuta en la raíz del proyecto:

```powershell
mise install
```

`mise` leerá el archivo `mise.toml` del repositorio e instalará automáticamente la versión exacta de **Python (3.14)** y las herramientas requeridas.

> ⚠️ **Importante (Solo para usuarios de Windows):**
> 
> Windows incluye por defecto alias falsos de `python.exe` y `python3.exe` que redirigen a la Microsoft Store e impiden que `mise` funcione de inmediato.
> 
> Para desactivarlos, ejecuta en PowerShell:
> ```powershell
> Start-Process ms-settings:appsfeatures-appexecutionalias
> ```
> En la ventana que se abre, **desactiva** los interruptores de:
> * **Instalador de la aplicación (`python.exe`)**
> * **Instalador de la aplicación (`python3.exe`)**
> 
> Cierra y vuelve a abrir tu terminal de PowerShell para que tome el cambio.

---

### Paso 2.2: Instalar las dependencias en el entorno virtual

Ejecuta el siguiente comando:

```powershell
mise exec -- pip install -r server/requirements-dev.txt
```

> **¿Dónde se instalan?**
> Gracias a la directiva `_.python.venv = { path = ".venv", create = true }` configurada en `mise.toml`, `mise` crea de forma automática una carpeta local `.venv` dentro del proyecto e instala todos los paquetes aislados allí (sin alterar tu sistema global).

---

### Paso 2.3: Configurar variables de entorno (Opcional)

Si deseas utilizar proveedores de clima en vivo con Meteomatics o el copiloto IA en `ai.edream.dev`:

```powershell
Copy-Item .env.example .env
```
*(Sin claves de API, el proyecto funcionará igualmente utilizando el proveedor libre Open-Meteo y el copiloto local por reglas).*

Completa `OPENAI_API_KEY` en `.env`; `OPENAI_BASE_URL` y `OPENAI_MODEL` ya vienen con `https://ai.edream.dev/v1` y `gpt-6.1-sol`. La clave queda en el backend y no se comparte con el navegador.

---

## 3. Iniciar el proyecto

Una vez completada la instalación, puedes arrancar el servidor backend (FastAPI) y la aplicación web frontend con cualquiera de las siguientes alternativas equivalentes:

### Opción A: Con `mise` (Recomendada)
```powershell
mise run dev
```

### Opción B: Con `npm` o `pnpm`
```powershell
pnpm start
# o:
npm start
```

### Opción C: Con Python directo
```powershell
python -m server.main
```

### Opción D: Con el módulo de Uvicorn
```powershell
python -m uvicorn server.main:app --reload --port 8000
```

---

## 4. Verificación en el navegador

Al iniciar el servidor, abre tu navegador en:

* **Aplicación Web (Frontend):** [http://localhost:8000](http://localhost:8000)
* **Estado de la API:** [http://localhost:8000/api/health](http://localhost:8000/api/health)
* **Documentación interactiva OpenAPI (Swagger):** [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

---

## 5. Solución de problemas frecuentes

1. **`python : no se encontró Python; ejecutar sin argumentos para instalar desde Microsoft Store...`**
   * Sigue las instrucciones del recuadro de aviso en el **Paso 2.1** para desactivar los alias de la tienda en Windows.
2. **`mise shims are shadowed by executables earlier in PATH`**
   * Asegúrate de haber desactivado los alias de ejecución de Windows y ejecuta `mise reshim`.
3. **Error de permisos al ejecutar scripts en PowerShell (`Activate.ps1 cannot be loaded`)**
   * No necesitas activar scripts manualmente ya que `mise` gestiona el `.venv`, pero si lo requieres puedes habilitar la ejecución de scripts con:
     ```powershell
     Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
     ```
