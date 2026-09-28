package com.goldshoot.phaser;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.webkit.*;
import android.view.View;
import android.view.WindowInsets;
import android.os.Build;
import android.widget.FrameLayout;
import java.io.*;
import java.util.*;

/** Offline HTTPS asset origin: no file:// CORS bypass and no JavaScript native bridge. */
public class MainActivity extends Activity {
  private WebView web;
  private View fullscreen;
  private WebChromeClient.CustomViewCallback fullscreenCallback;
  private static final String HOST = "appassets.androidplatform.net";
  @Override public void onCreate(Bundle saved) {
    super.onCreate(saved);
    getWindow().setStatusBarColor(0xff10162a);
    getWindow().setNavigationBarColor(0xff10162a);
    web = new WebView(this);
    web.getSettings().setJavaScriptEnabled(true);
    web.getSettings().setDomStorageEnabled(true);
    web.getSettings().setAllowFileAccess(false);
    web.getSettings().setAllowContentAccess(false);
    web.getSettings().setMediaPlaybackRequiresUserGesture(false);
    web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    web.setWebViewClient(new WebViewClient() {
      @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (!HOST.equals(uri.getHost())) return response(403, "Forbidden");
        String name = uri.getPath();
        if (name == null || name.contains("..")) return response(403, "Forbidden");
        if (name.endsWith("/")) name += "index.html";
        try {
          String type = name.endsWith(".js") || name.endsWith(".mjs") ? "text/javascript" : name.endsWith(".html") ? "text/html" : name.endsWith(".css") ? "text/css" : (name.endsWith(".md") || name.endsWith(".ts")) ? "text/plain" : name.endsWith(".json") ? "application/json" : name.endsWith(".png") ? "image/png" : name.endsWith(".jpg") ? "image/jpeg" : name.endsWith(".mp3") ? "audio/mpeg" : "application/octet-stream";
          return new WebResourceResponse(type, "UTF-8", 200, "OK", Collections.singletonMap("Cache-Control", "public, max-age=3600"), getAssets().open("site" + name));
        } catch (IOException error) { return response(404, "Not Found"); }
      }
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (HOST.equals(uri.getHost())) return false;
        if (request.isForMainFrame() && ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) {
          try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
        }
        return true;
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onShowCustomView(View view, CustomViewCallback callback) {
        if (fullscreen != null) { callback.onCustomViewHidden(); return; }
        fullscreen = view; fullscreenCallback = callback;
        ((FrameLayout)getWindow().getDecorView()).addView(view, new FrameLayout.LayoutParams(-1, -1));
        getWindow().getDecorView().setSystemUiVisibility(5894);
      }
      @Override public void onHideCustomView() { exitFullscreen(); }
    });
    FrameLayout content = new FrameLayout(this);
    content.setBackgroundColor(0xff10162a);
    content.addView(web, new FrameLayout.LayoutParams(-1, -1));
    content.setOnApplyWindowInsetsListener((view, insets) -> {
      int left, top, right, bottom;
      if (Build.VERSION.SDK_INT >= 30) {
        android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
        left = bars.left; top = bars.top; right = bars.right; bottom = bars.bottom;
      } else {
        left = insets.getSystemWindowInsetLeft(); top = insets.getSystemWindowInsetTop();
        right = insets.getSystemWindowInsetRight(); bottom = insets.getSystemWindowInsetBottom();
      }
      view.setPadding(left, top, right, bottom);
      return insets;
    });
    setContentView(content);
    if (saved == null || web.restoreState(saved) == null) web.loadUrl("https://" + HOST + "/index.html");
  }
  private WebResourceResponse response(int status, String message) {
    return new WebResourceResponse("text/plain", "UTF-8", status, message, Collections.emptyMap(), new ByteArrayInputStream(message.getBytes()));
  }
  private void exitFullscreen() {
    if (fullscreen == null) return;
    ((FrameLayout)getWindow().getDecorView()).removeView(fullscreen); fullscreen = null;
    fullscreenCallback.onCustomViewHidden(); fullscreenCallback = null;
    getWindow().getDecorView().setSystemUiVisibility(0);
  }
  @Override public void onBackPressed() { if (fullscreen != null) exitFullscreen(); else if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
  @Override protected void onPause() { super.onPause(); web.evaluateJavascript("window.dispatchEvent(new Event('blur')); for(const f of document.querySelectorAll('iframe'))f.contentWindow?.postMessage({type:'collection:pause'},location.origin)", null); web.onPause(); web.pauseTimers(); }
  @Override protected void onResume() { super.onResume(); if (web != null) { web.onResume(); web.resumeTimers(); } }
  @Override protected void onSaveInstanceState(Bundle out) { web.saveState(out); super.onSaveInstanceState(out); }
  @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }
}
