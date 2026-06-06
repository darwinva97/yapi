package com.yapi.app;

import android.content.Context;

import com.lynx.tasm.provider.AbsTemplateProvider;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

/** Carga el bundle .lynx.bundle desde los assets de la app. */
public class DemoTemplateProvider extends AbsTemplateProvider {
    private final Context mContext;

    DemoTemplateProvider(Context context) {
        this.mContext = context.getApplicationContext();
    }

    @Override
    public void loadTemplate(String uri, Callback callback) {
        new Thread(() -> {
            try (InputStream inputStream = mContext.getAssets().open(uri);
                 ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[1024];
                int length;
                while ((length = inputStream.read(buffer)) != -1) {
                    out.write(buffer, 0, length);
                }
                callback.onSuccess(out.toByteArray());
            } catch (IOException e) {
                callback.onFailed(e.getMessage());
            }
        }).start();
    }
}
