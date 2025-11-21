# ACW‑App v5.6.2 — Blue Glass White Connected
**Allston Car Wash** · JAG15 & Sky · © 2025

Aplicación web (PWA) para que empleados y supervisores vean el horario, horas en vivo y acciones rápidas de gestión.

---

## 🚀 Demo local rápida
1. Descarga y descomprime este proyecto.
2. (Opcional) Lanza un servidor estático:
   - **Node**: `npx serve -p 5173 .`
   - **Python**: `python -m http.server 5173`
3. Abre `http://localhost:5173` (o el puerto que uses).
4. Inicia sesión con un usuario válido del backend GAS.

> **Nota:** El Service Worker (PWA) solo funciona bajo `https://` o `http://localhost`.

---

## ⚙️ Configuración
Edita `config.js`:
```js
const CONFIG = {
  BASE_URL: "https://script.google.com/macros/s/<TU_SCRIPT_ID>/exec",
  VERSION: "v5.6.2 — Blue Glass White Connected Edition"
};
```
- `BASE_URL` debe apuntar a tu **Web App de Google Apps Script** publicada con acceso *Anyone with the link* (o el nivel que uses).
- Cambia `VERSION` cada vez que despliegues para forzar limpieza de caché en clientes.

---

## 🧩 Funcionalidades principales
- **Login** conectado a GAS (`action=login`).
- **Dashboard**: saludo, tabla de la semana, **Total Hours** y **⏱️ Live Hours** (si el turno del día termina con punto `7:30.`).
- **Team View (manager/supervisor)**: directorio paginado, horas totales, columna *🟢 Working* en tiempo real y acceso a **Employee Modal**.
- **Employee Modal**:
  - Editar turnos por día (solo managers) → `action=updateShift`.
  - Envíos rápidos **Send Today / Send Tomorrow** → `action=sendtoday|sendtomorrow`.
- **Change Password** → `action=changePassword`.
- **PWA**: `manifest.json` + `sw.js` con caché estático y **sin interceptar** llamadas al backend GAS.
- **Toasts** y UI “Blue Glass White”.

---

## 🔌 Endpoints esperados (GAS)
El frontend llama al `BASE_URL` con los siguientes `action` (método GET, respuesta JSON):
- `login&email&password` → `{ ok, name, email, role }`
- `getSmartSchedule&email` → `{ ok, days:[{name,shift,hours}], total }`
- `getEmployeesDirectory` → `{ ok, directory:[{name,email,phone,role}] }`
- `updateShift&actor&target&day&shift` → `{ ok:true }`
- `changePassword&email&oldPass&newPass` → `{ ok:true }`
- `sendtoday|sendtomorrow&actor&target` → `{ ok:true, message:"..." }`

> Ajusta tus doGet(e) y CORS si hospedas en dominio propio (añade cabeceras `Access-Control-Allow-Origin`).

---

## 🗂️ Estructura
```
acw-app-v5_6_2/
├─ index.html
├─ style.css
├─ app.js
├─ config.js
├─ sw.js
├─ manifest.json
├─ acw-icon-512.png
└─ README.md  ← este archivo
```

---

## 📦 Deploy
### GitHub Pages
1. Sube todos los archivos a una rama (por ej. `main`).
2. En **Settings → Pages**, selecciona la rama y `/ (root)`.
3. Espera a que se publique y navega a la URL.
   - Si actualizas, incrementa `CACHE_NAME` en `sw.js` o la `VERSION` de `config.js`.

### Netlify / Cloudflare Pages / Vercel
- Arrastra la carpeta a Netlify o conecta el repo. No requiere *build* (sitio estático).

---

## 🔐 Notas de seguridad
- `localStorage` guarda una copia de la sesión (`acwUser`) para restaurar el estado.
- Usa **HTTPS** y limita los *scopes* de Apps Script.
- Valida en backend el rol del `actor` para acciones de manager.

---

## 🛠️ Problemas comunes
- **Login inválido**: revisa `action=login` y permisos de GAS.
- **CORS**: si la web **no** está en `apps.googleusercontent.com`, añade cabeceras CORS en GAS.
- **Cache vieja**: pulsa **Update / Clear Cache** en *Settings* o cambia `VERSION`/`CACHE_NAME`.
- **Offline 404**: el SW solo cachea archivos estáticos listados en `FILES_TO_CACHE`.

---

## 🧾 Licencia y crédito
Uso interno de **Allston Car Wash**. Desarrollo: **JAG15 & Sky** (2025).
