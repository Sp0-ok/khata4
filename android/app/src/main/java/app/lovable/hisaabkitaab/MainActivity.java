package app.lovable.hisaabkitaab;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    WebView webView = this.bridge.getWebView();
    if (webView == null) return;

    webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
    webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

    WebSettings settings = webView.getSettings();
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setTextZoom(100);
    settings.setMediaPlaybackRequiresUserGesture(false);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      settings.setForceDark(WebSettings.FORCE_DARK_OFF);
    }
  }
}
