Environment fact: this Windows setup has CMake installed as `cmake version 3.31.6-msvc6` (Kitware/MSVC variant). <!-- created=2026-07-15, last=2026-07-15 -->
§
Pi sessions: sessions saved as JSONL in `~/.pi/agent/sessions/`. Commands: `pi -c` (continue recent), `pi -r` (browse), `pi --fork <id>` (fork), `pi --name`, `pi --session`, `pi --no-session`. Tree = each message is a node with parent pointer; branching occurs when you navigate back and take a different path. `/tree` command shows the tree. When leaving a branch, pi offers to summarize that branch and attach the summary to the new branch. <!-- created=2026-07-15, last=2026-07-15 -->
§
In `Alsmart.ECL.MainController.Main`, `master_send_data()` / `master_request_data()` clear `response_buffer` after dispatching it to `i2c_process_received_data()`. Callers must not inspect `response_buffer` afterward; cache parsed firmware-update responses and expose getters instead. <!-- created=2026-07-22, last=2026-07-22 -->
§
In Alsmart.ECL.ISO.Main, i3c_slave_init() was originally called in R_BSP_WarmStart (pre-RTOS, PRIMASK=1). Hardware ACKed master writes but rcv_isr couldn't fire; 16 messages queued, RSQ overflow hit on RTOS start → INEF → RSM=1 → slave deaf after first message. Fix: move i3c_slave_init() out of R_BSP_WarmStart into the io_thread after RTOS starts. <!-- created=2026-07-24, last=2026-07-24 -->
§
In Alsmart.ECL.ISO.Main I3C error recovery: when i3c_eei_isr fires (RSQ overflow/INEF), FSP sets RSM=1 but does NOT flush the TX FIFO. Stale TX bytes left in FIFO (visible as NDBSTLV0.TDBFLV < 16) block subsequent master WRITEs because slave is stuck expecting a READ. Fix added RSTCTL TX FIFO flush (R_I3C0_RSTCTL_TDBRST_Msk) in the rearm path. <!-- created=2026-07-24, last=2026-07-24 -->
§
In Alsmart.ECL.ISO.Main I3C slave: if i3c_send_data() (R_I3C_Write) fails (e.g. FSP_ERR_IN_USE after error recovery), must immediately call i3c_rearm_rx() to re-arm RX; otherwise slave goes deaf. Fix added to i3c_app.c i3c_send_data() failure path. <!-- created=2026-07-24, last=2026-07-24 -->
§
Windows Python CLI on this setup may use cp1252/charmap for stdout; inline scripts that print non-ASCII characters can fail with UnicodeEncodeError. Prefer ASCII-only console output or force UTF-8/explicit encoding. <!-- created=2026-09-09, last=2026-09-09 -->
§
Azure DevOps Windows agents may run PowerShell 5.1, where `Invoke-RestMethod -Form` is unsupported. Use Python `requests` or .NET `System.Net.Http` multipart APIs instead. <!-- created=2026-09-09, last=2026-09-09 -->
§
SEGGER RTT telnet on port 19021 allows only one active client on this setup; if the port refuses a second connection, you can still inspect the `_SEGGER_RTT` control block/ring buffer through GDB to recover recent RTT log output. <!-- created=2026-09-23, last=2026-09-23 -->
§
Renesas RA FSP 6.0.0 mbedTLS generation quirk: disabling LMS in configuration.xml / the FSP configurator may still leave a bare `#define MBEDTLS_LMS_C` in generated `ra_cfg/arm/mbedtls/config.h`, causing `mbedtls/check_config.h:415` to fail with `MBEDTLS_LMS_C requires MBEDTLS_PSA_CRYPTO_C and PSA_WANT_ALG_SHA_256`. In-session comparison across generated projects suggested a generator/template bug rather than a user config mismatch. <!-- created=2026-09-27, last=2026-09-27 -->
§
Renesas FSP 6.0.0 mbedTLS generation can leave MBEDTLS_LMS_C effectively enabled even when configuration.xml sets it to Undefine: generated ra_cfg/arm/mbedtls/config.h contains an unconditional bare '#define MBEDTLS_LMS_C' above the FSP-controlled '#if 0' block. Treat LMS disable issues as a generator/template quirk; do not hand-edit generated config.h. <!-- created=2026-09-27, last=2026-09-27 -->
§
Renesas FSP 6.0.0 rm_psa_crypto/mbedTLS quirk: disabling `MBEDTLS_LMS_C` in `configuration.xml` may still leave a bare `#define MBEDTLS_LMS_C` in generated `ra_cfg/arm/mbedtls/config.h`, causing the LMS/PSA dependency error in `check_config.h`. <!-- created=2026-09-27, last=2026-09-27 -->