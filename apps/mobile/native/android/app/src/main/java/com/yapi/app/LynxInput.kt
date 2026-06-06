package com.yapi.app

import android.content.Context
import android.graphics.Color
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.view.inputmethod.InputMethodManager
import androidx.appcompat.widget.AppCompatEditText
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.behavior.LynxProp
import com.lynx.tasm.behavior.ui.LynxUI
import com.lynx.tasm.event.LynxCustomEvent

/**
 * Elemento nativo <input> para Lynx (no viene en el engine por defecto).
 * Envuelve un EditText y emite el evento `input` con detail.value para que
 * el JS lo reciba vía `bindinput={(e) => e.detail.value}`.
 */
class LynxInput(context: LynxContext) : LynxUI<AppCompatEditText>(context) {

    override fun createView(context: Context): AppCompatEditText {
        val view = AppCompatEditText(context)
        view.background = null
        view.setPadding(40, 0, 40, 0)
        view.textSize = 16f
        view.setTextColor(Color.WHITE)
        view.setHintTextColor(Color.parseColor("#5b606b"))
        view.isSingleLine = true
        view.isFocusable = true
        view.isFocusableInTouchMode = true

        // Lynx puede interceptar el touch; forzamos foco + teclado al tocar.
        view.setOnClickListener {
            view.requestFocus()
            val imm =
                context.getSystemService(Context.INPUT_METHOD_SERVICE)
                    as InputMethodManager
            imm.showSoftInput(view, InputMethodManager.SHOW_IMPLICIT)
        }

        view.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, st: Int, c: Int, a: Int) {}
            override fun onTextChanged(s: CharSequence?, st: Int, b: Int, c: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val event = LynxCustomEvent(getSign(), "input")
                event.addDetail("value", s?.toString() ?: "")
                getLynxContext().getEventEmitter().sendCustomEvent(event)
            }
        })
        return view
    }

    @LynxProp(name = "placeholder")
    fun setPlaceholder(value: String?) {
        mView.hint = value ?: ""
    }

    @LynxProp(name = "placeholder-color")
    fun setPlaceholderColor(value: String?) {
        if (!value.isNullOrEmpty()) {
            try {
                mView.setHintTextColor(Color.parseColor(value))
            } catch (_: Exception) {
            }
        }
    }

    @LynxProp(name = "value")
    fun setValue(value: String?) {
        val v = value ?: ""
        if (v != mView.text.toString()) {
            mView.setText(v)
            mView.setSelection(v.length)
        }
    }

    @LynxProp(name = "type")
    fun setType(value: String?) {
        mView.inputType =
            if (value == "password") {
                InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            } else {
                InputType.TYPE_CLASS_TEXT
            }
    }
}
