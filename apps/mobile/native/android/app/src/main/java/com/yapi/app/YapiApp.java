package com.yapi.app;

import android.app.Application;

import com.lynx.tasm.LynxEnv;
import com.lynx.tasm.service.LynxServiceCenter;
import com.lynx.service.log.LynxLogService;
import com.lynx.service.http.LynxHttpService;
import com.yapi.fcm.FcmModule;
import com.yapi.auth.SocialAuthModule;
import com.yapi.ingest.IngestModule;

public class YapiApp extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        initLynxServices();
        LynxEnv.inst().init(this, null, null, null);
        // Expone el token FCM a la app ReactLynx: NativeModules.FcmModule.getToken(...)
        LynxEnv.inst().registerModule("FcmModule", FcmModule.class);
        // Login social: NativeModules.SocialAuthModule.signInGoogle/Facebook(...)
        LynxEnv.inst().registerModule("SocialAuthModule", SocialAuthModule.class);
        // Reenviador: NativeModules.IngestModule.setSession(...) + acceso a notifs.
        LynxEnv.inst().registerModule("IngestModule", IngestModule.class);
    }

    private void initLynxServices() {
        LynxServiceCenter.inst().registerService(LynxLogService.INSTANCE);
        LynxServiceCenter.inst().registerService(LynxHttpService.INSTANCE);
    }
}
