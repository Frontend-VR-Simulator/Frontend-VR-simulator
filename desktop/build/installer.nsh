!macro customInit
  ; Reinstalls and upgrades start without stale executable paths or tokens.
  RMDir /r "$APPDATA\VR Simulation Launcher"
  ; Also clear state written by builds that used the package name.
  RMDir /r "$APPDATA\vr-simulation-launcher"
!macroend
