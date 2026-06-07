package com.yapi.nativeapp

import android.content.Context
import android.content.Intent

/** Apps del lanzador instaladas, para elegir de cuáles escuchar notificaciones. */
object InstalledApps {
    fun list(context: Context): List<AppRef> {
        val pm = context.packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val resolveInfos = pm.queryIntentActivities(intent, 0)
        val seen = HashSet<String>()
        val out = ArrayList<AppRef>()
        for (ri in resolveInfos) {
            val pkg = ri.activityInfo?.packageName ?: continue
            if (pkg == context.packageName) continue
            if (!seen.add(pkg)) continue
            val label = ri.loadLabel(pm)?.toString() ?: pkg
            out.add(AppRef(pkg, label))
        }
        return out.sortedBy { it.label.lowercase() }
    }
}
