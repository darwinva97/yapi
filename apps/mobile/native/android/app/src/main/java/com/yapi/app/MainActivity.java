package com.yapi.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.view.View;

import com.lynx.tasm.LynxView;
import com.lynx.tasm.LynxViewBuilder;
import com.lynx.tasm.behavior.Behavior;
import com.lynx.tasm.behavior.LynxContext;
import com.lynx.tasm.behavior.ui.LynxUI;
import com.yapi.auth.CurrentActivity;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // El SocialAuthModule necesita una Activity viva para abrir Google/Facebook.
        CurrentActivity.setActivity(this);

        LynxViewBuilder builder = new LynxViewBuilder();
        builder.setTemplateProvider(new DemoTemplateProvider(this));

        // Mide la página a pantalla completa (si no, Lynx envuelve al alto del contenido).
        DisplayMetrics dm = getResources().getDisplayMetrics();
        builder.setPresetMeasuredSpec(
                View.MeasureSpec.makeMeasureSpec(dm.widthPixels, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(dm.heightPixels, View.MeasureSpec.EXACTLY));

        // Elemento <input> nativo (no viene en el engine por defecto).
        builder.addBehavior(new Behavior("input") {
            @Override
            public LynxUI createUI(LynxContext context) {
                return new LynxInput(context);
            }
        });

        LynxView lynxView = builder.build(this);
        setContentView(lynxView);

        lynxView.renderTemplateUrl("main.lynx.bundle", "");
    }

    @Override
    protected void onResume() {
        super.onResume();
        CurrentActivity.setActivity(this);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        // Reenvía el resultado al SDK de Facebook (completa el LoginManager).
        CurrentActivity.handleActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (CurrentActivity.getActivity() == this) {
            CurrentActivity.setActivity(null);
        }
    }
}
