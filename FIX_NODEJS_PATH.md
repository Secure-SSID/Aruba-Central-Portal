# Fix: Node.js Installed But Not Working

## Problem

Node.js is installed but PowerShell can't find it:
```
node : The term 'node' is not recognized...
```

This happens when Node.js is not in your PATH environment variable.

## Quick Fix (For This Session)

**Option 1: Run the build script** (it now fixes PATH automatically)
```powershell
cd F:\DockerClone\aruba-central-portal
powershell -ExecutionPolicy Bypass -File .\build-frontend-simple.ps1
```

The script will automatically find Node.js and add it to PATH for the current session.

**Option 2: Manually add to PATH for this session**
```powershell
$env:PATH += ";C:\Program Files\nodejs"
node --version  # Should work now
```

## Permanent Fix

To fix this permanently so Node.js works in all PowerShell sessions:

### Method 1: Add to System PATH (Recommended)

1. **Open System Properties**:
   - Press `Win + R`
   - Type: `sysdm.cpl`
   - Press Enter
   - Click "Environment Variables" button

2. **Edit PATH**:
   - Under "System variables", find "Path"
   - Click "Edit"
   - Click "New"
   - Add: `C:\Program Files\nodejs`
   - Click "OK" on all dialogs

3. **Restart PowerShell**

### Method 2: Using PowerShell (Run as Administrator)

```powershell
# Run PowerShell as Administrator first!
[Environment]::SetEnvironmentVariable(
    "Path",
    [Environment]::GetEnvironmentVariable("Path", "Machine") + ";C:\Program Files\nodejs",
    "Machine"
)
```

Then restart PowerShell.

### Method 3: User PATH Only

If you can't modify system PATH, add to user PATH:

```powershell
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$nodePath = "C:\Program Files\nodejs"
if ($userPath -notlike "*$nodePath*") {
    [Environment]::SetEnvironmentVariable(
        "Path",
        "$userPath;$nodePath",
        "User"
    )
    Write-Host "Added Node.js to User PATH. Please restart PowerShell."
}
```

## Verify It's Fixed

After making changes, **restart PowerShell** and run:

```powershell
node --version
npm --version
```

Both should show version numbers without errors.

## Note

The build script (`build-frontend-simple.ps1`) now automatically fixes the PATH issue for that session, so you can build the frontend even if PATH isn't permanently fixed. However, for convenience, it's best to fix it permanently.

