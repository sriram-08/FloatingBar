import webview
import json
import sys
import requests  # pip install requests

class DesktopAPI:
    def __init__(self):
        self._window = None

    def set_window(self, window):
        self._window = window

    def resize_window(self, width, height):
        """Dynamically changes the native window size when expanding/collapsing."""
        if self._window:
            # Clamp to screen size so we never overflow
            monitor = webview.screens[0]
            clamped_w = min(width, int(monitor.width * 0.95))
            clamped_h = min(height, int(monitor.height * 0.90))
            self._window.resize(clamped_w, clamped_h)

    def change_position(self, position):
        """Moves the floating bar to different edges of the screen."""
        if not self._window:
            return "No window"

        monitor = webview.screens[0]
        screen_w = monitor.width
        screen_h = monitor.height

        current_w = self._window.width
        current_h = self._window.height

        margin = 20

        positions = {
            'top':    ((screen_w - current_w) // 2, margin),
            'bottom': ((screen_w - current_w) // 2, screen_h - current_h - 60),
            'left':   (margin, (screen_h - current_h) // 2),
            'right':  (screen_w - current_w - margin, (screen_h - current_h) // 2),
        }

        if position not in positions:
            return f"Unknown position: {position}"

        x, y = positions[position]
        self._window.move(int(x), int(y))
        return f"Moved to {position}"

    def save_reminder_to_cloud(self, reminder_json):
        """
        Sends reminder data to your BuildHub cloud API.
        Replace the URL and auth header with your real values.
        """
        data = json.loads(reminder_json)
        print(f"[CLOUD SYNC] Reminder: {data}")

        # --- Uncomment and configure for real cloud sync ---
        # try:
        #     resp = requests.post(
        #         "https://api.buildhubcode.xyz/reminders",
        #         json=data,
        #         headers={"Authorization": "Bearer YOUR_TOKEN"},
        #         timeout=5
        #     )
        #     return {"status": "success", "remote_id": resp.json().get("id")}
        # except Exception as e:
        #     print(f"[CLOUD SYNC ERROR] {e}")
        #     return {"status": "error", "message": str(e)}

        return {"status": "success", "message": "Logged locally"}

    def get_screen_info(self):
        """Returns screen dimensions for adaptive sizing."""
        monitor = webview.screens[0]
        return {"width": monitor.width, "height": monitor.height}


if __name__ == '__main__':
    api = DesktopAPI()

    # Detect screen size to set a sensible initial window size
    # pywebview needs a window before we can call webview.screens,
    # so we use a reasonable default and let JS adapt.
    window = webview.create_window(
        title='BuildHub Companion Bar',
        url='web/index.html',       # Path to your frontend directory
        js_api=api,                 # Expose Python API to JS as window.pywebview.api
        frameless=True,             # No OS title bar
        easy_drag=True,             # Drag anywhere on empty space
        on_top=True,                # Always float above other windows
        transparent=True,           # <--- CHANGED: Tells the OS window container to be alpha-transparent
        width=580,
        height=72,                  # Initial collapsed bar size
        min_size=(280, 56),         # Minimum usable size
    )

    api.set_window(window)

    # CHANGED: Specifying 'edgechromium' guarantees true alpha window transparency on Windows machines
    webview.start(debug='--debug' in sys.argv, gui='edgechromium')