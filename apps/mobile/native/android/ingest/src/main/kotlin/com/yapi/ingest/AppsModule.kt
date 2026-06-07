package com.yapi.ingest

import android.content.Context
import android.content.Intent
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback
import org.json.JSONArray
import org.json.JSONObject

/**
 * Lista las apps instaladas (las que aparecen en el lanzador) para que el usuario
 * elija de cuáles escuchar notificaciones.
 *
 * Lado JS (apps/mobile/src/installedApps.ts):
 *   NativeModules.AppsModule.getInstalledApps((json) => { ... })  // [{package,label}]
 *
 * Requiere en el AndroidManifest un <queries> con el intent del lanzador (API 30+).
 */
class AppsModule(context: Context) : LynxModule(context) {

    private val app: Context = context.applicationContext

    @LynxMethod
    fun getInstalledApps(callback: Callback) {
        // En hilo aparte: cargar las etiquetas de muchas apps puede tardar.
        Thread {
            val json =
                try {
                    val pm = app.packageManager
                    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                    val resolveInfos = pm.queryIntentActivities(intent, 0)
                    val seen = HashSet<String>()
                    val arr = JSONArray()
                    for (ri in resolveInfos) {
                        val pkg = ri.activityInfo?.packageName ?: continue
                        if (pkg == app.packageName) continue // no incluir yapi
                        if (!seen.add(pkg)) continue // un item por package
                        val label = ri.loadLabel(pm)?.toString() ?: pkg
                        arr.put(JSONObject().put("package", pkg).put("label", label))
                    }
                    arr.toString()
                } catch (e: Exception) {
                    "[]"
                }
            callback.invoke(json)
        }.start()
    }
}
