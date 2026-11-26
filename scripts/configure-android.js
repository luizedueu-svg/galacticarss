const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = process.cwd();
const androidAppDir = path.join(rootDir, 'android', 'app');
const manifestPath = path.join(androidAppDir, 'src', 'main', 'AndroidManifest.xml');
const mainActivityPath = path.join(
  androidAppDir,
  'src',
  'main',
  'java',
  'com',
  'galacticarss',
  'app',
  'MainActivity.java'
);

// 1. Configura AndroidManifest.xml (permite feeds HTTP antigos e registra Share Target nativo)
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');

  if (!manifest.includes('android:usesCleartextTraffic')) {
    manifest = manifest.replace(
      '<application',
      '<application\n        android:usesCleartextTraffic="true"'
    );
  }

  if (!manifest.includes('android.intent.action.SEND')) {
    const shareIntentFilter = `
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/plain" />
            </intent-filter>`;
    manifest = manifest.replace('</activity>', `${shareIntentFilter}\n        </activity>`);
  }

  fs.writeFileSync(manifestPath, manifest, 'utf8');
  console.log('AndroidManifest.xml configurado com sucesso.');
}

// 2. Atualiza MainActivity.java para encaminhar links compartilhados (ACTION_SEND) ao WebView
const mainActivityCode = `package com.galacticarss.app;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleShareIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleShareIntent(intent);
    }

    private void handleShareIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();
        if (Intent.ACTION_SEND.equals(action) && type != null && "text/plain".equals(type)) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            String sharedTitle = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            if (sharedText != null && !sharedText.isEmpty()) {
                try {
                    JSONObject payload = new JSONObject();
                    payload.put("text", sharedText);
                    payload.put("title", sharedTitle != null ? sharedTitle : "");
                    final String js = "window.__GALACTICA_ANDROID_SHARE__ = " + payload.toString() + ";" +
                        "window.dispatchEvent(new CustomEvent('galactica-android-share', { detail: window.__GALACTICA_ANDROID_SHARE__ }));";
                    if (this.bridge != null && this.bridge.getWebView() != null) {
                        WebView webView = this.bridge.getWebView();
                        webView.post(() -> webView.evaluateJavascript(js, null));
                    }
                } catch (Exception ignored) {}
            }
        }
    }
}
`;

fs.mkdirSync(path.dirname(mainActivityPath), { recursive: true });
fs.writeFileSync(mainActivityPath, mainActivityCode, 'utf8');
console.log('MainActivity.java atualizado com suporte a Share Intent.');

// 3. Aplica ícone personalizado com margem de respiro nos recursos Android
const sourceIcon = path.join(rootDir, 'icon-128.png');
const resDir = path.join(androidAppDir, 'src', 'main', 'res');

if (fs.existsSync(sourceIcon) && fs.existsSync(resDir)) {
  const paddedIcon = path.join(rootDir, 'icon-padded.png');
  let iconToCopy = sourceIcon;

  try {
    execSync(`convert "${sourceIcon}" -resize 340x340 -background "#131314" -gravity center -extent 512x512 "${paddedIcon}"`);
    if (fs.existsSync(paddedIcon)) {
      iconToCopy = paddedIcon;
    }
  } catch (e) {
    // Fallback direto para o ícone original caso ImageMagick não esteja disponível
  }

  const densities = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
  densities.forEach((density) => {
    const dir = path.join(resDir, density);
    if (fs.existsSync(dir)) {
      fs.copyFileSync(iconToCopy, path.join(dir, 'ic_launcher.png'));
      fs.copyFileSync(iconToCopy, path.join(dir, 'ic_launcher_round.png'));
      fs.copyFileSync(iconToCopy, path.join(dir, 'ic_launcher_foreground.png'));
    }
  });

  if (fs.existsSync(paddedIcon)) {
    fs.unlinkSync(paddedIcon);
  }
  console.log('Ícones do aplicativo Android atualizados.');
}
