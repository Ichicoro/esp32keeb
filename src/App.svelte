<script lang="ts">
  import { KEYCODES, MOUSE_KEYS } from "./keycodes";
  import { usePointerlock } from "@terrygonguet/svelte-pointerlock";

  const {
    exit: exitPointerlock,
    pointerlock,
    enter: enterPointerlock,
  } = usePointerlock();

  const readyKeycodes = $derived(Object.entries(KEYCODES));
  let mouselockOn = $state(false);
  let output = $state("");

  const logToOutput = (text: string) => {
    output = text + "\n" + output;
  };

  $effect(() => {
    // console.log("output changed, scrolling to bottom");
    // document.getElementById("output")?.scrollTo(0, 1e10);
  });

  let showExtraButtons = $state(false);
  let h1style = $derived(
    showExtraButtons ? "margin-top: 0.67em" : "margin-top: 0;",
  );

  let supportsLock = $derived(
    "keyboard" in navigator && "lock" in navigator.keyboard!,
  );
  let connStatus = $state("disconnected") as "disconnected" | "connected";
  let keyboardLocked = $state(false);

  if ("serial" in navigator) {
    console.log("Web Serial API is supported.");
  } else {
    console.log("Web Serial API is not supported.");
  }

  let port: SerialPort | null = $state(null);
  let reader = $state<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  let writer = $state<WritableStreamDefaultWriter<Uint8Array> | null>(null);

  const sendKeycode = (
    keycode: number,
    type: "click" | "press" | "release" = "click",
  ) => {
    if (type === "click") {
      writer?.write(new Uint8Array([0x00, 0x01, 0x01, keycode, 0xff]));
      writer?.write(new Uint8Array([0x00, 0x01, 0x02, keycode, 0xff]));
    } else if (type === "press") {
      writer?.write(new Uint8Array([0x00, 0x01, 0x01, keycode, 0xff]));
    } else if (type === "release") {
      writer?.write(new Uint8Array([0x00, 0x01, 0x02, keycode, 0xff]));
    }
  };

  const moveMouse = (x: number, y: number) => {
    if (connStatus !== "connected" || !mouselockOn) return;
    if (!keyboardLocked) return;

    const first16bitX = x & 0xff;
    const second16bitX = (x >> 8) & 0xff;
    const first16bitY = y & 0xff;
    const second16bitY = (y >> 8) & 0xff;

    writer?.write(
      new Uint8Array([
        0x00,
        0x02,
        0x05,
        first16bitX,
        second16bitX,
        first16bitY,
        second16bitY,
        0xff,
      ]),
    );
  };

  const lockKeyboard = async () => {
    if (supportsLock && connStatus === "connected") {
      try {
        if (mouselockOn) {
          enterPointerlock();
        }
        await document.documentElement.requestFullscreen();
        await navigator.keyboard!.lock!();
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("keyup", onKeyUp);
        logToOutput("Keyboard locked.\n");
        keyboardLocked = true;
      } catch (error) {
        logToOutput(`Error locking keyboard: ${error}\n`);
      }
    } else {
      logToOutput("Keyboard lock not supported.\n");
    }
  };

  const unlockKeyboard = async () => {
    if (mouselockOn) {
      exitPointerlock();
    }
    if (supportsLock) {
      try {
        document.exitFullscreen();
        await navigator.keyboard!.unlock!();
        keyboardLocked = false;
        logToOutput("Keyboard unlocked.\n");
      } catch (error) {
        logToOutput(`Error unlocking keyboard: ${error}\n`);
      }
    }
  };

  const clickConnect = async () => {
    try {
      /* @type {navigator.Serial} */
      const serial = navigator.serial;
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      logToOutput("Connected to the serial port.\n");
      connStatus = "connected";

      lockKeyboard();

      // connectButton!.disabled = true;
      // disconnectButton!.disabled = false;

      reader = port.readable!.getReader();
      writer = port.writable!.getWriter();
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          reader.releaseLock();
          break;
        }
        logToOutput(new TextDecoder().decode(value));
      }
    } catch (error) {
      logToOutput(`Error: ${error}\n`);
    }
  };

  const clickDisconnect = async () => {
    reader?.releaseLock();
    writer?.releaseLock();
    port?.close();
    unlockKeyboard();
    output += "Disconnected from the serial port.\n";
    connStatus = "disconnected";
    // connectButton.disabled = false;
    // disconnectButton.disabled = true;
  };

  const sendMouseButton = (button: number, action: "down" | "up") => {
    if (connStatus !== "connected") return;
    if (!keyboardLocked) return;
    if (action === "down") {
      writer?.write(new Uint8Array([0x00, 0x02, 0x01, button, 0xff]));
    } else if (action === "up") {
      writer?.write(new Uint8Array([0x00, 0x02, 0x02, button, 0xff]));
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // console.log(e);
    if (e.code === "CapsLock") {
      // Prevent CapsLock from toggling its state
      return;
    }
    if (connStatus === "connected") {
      e.preventDefault();
      // @ts-ignore
      const keycode = KEYCODES[e.code];
      if (keycode) {
        sendKeycode(keycode, "press");
      }
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    // console.log(e);
    if (e.code === "CapsLock") {
      // Prevent CapsLock from toggling its state
      return;
    }
    if (connStatus === "connected") {
      e.preventDefault();
      // @ts-ignore
      const keycode = KEYCODES[e.code];
      if (keycode) {
        sendKeycode(keycode, "release");
      }
    }
  };

  const onMouseMove = (e: MouseEvent) => {
    // console.log(e);
    if (connStatus === "connected") {
      moveMouse(e.movementX, e.movementY);
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    if (connStatus === "connected") {
      sendMouseButton(MOUSE_KEYS[e.button], "down");
    }
  };
  const onMouseUp = (e: MouseEvent) => {
    if (connStatus === "connected") {
      sendMouseButton(MOUSE_KEYS[e.button], "up");
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) {
        // Exited fullscreen
        unlockKeyboard();
        // document.removeEventListener("keydown", onKeyDown);
        // document.removeEventListener("keyup", onKeyUp);
      }
    });
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<main
  use:pointerlock
  class="relative"
  onmousemove={onMouseMove}
  onmousedown={onMouseDown}
  onmouseup={onMouseUp}
>
  <div class="p-4">
    <h1 style={h1style} class="mb-2">ESP32-S3 Keyboard</h1>
    <button onclick={clickConnect} disabled={connStatus === "connected"}
      >Connect</button
    >
    <button onclick={clickDisconnect} disabled={connStatus === "disconnected"}
      >Disconnect</button
    >

    {#if supportsLock}
      <button onclick={lockKeyboard}>Lock Keyboard</button>
      <button onclick={unlockKeyboard}>Unlock Keyboard</button>
    {/if}

    <div class="pt-2">
      <input type="checkbox" bind:checked={mouselockOn} id="mouselockOn" />
      <label for="mouselockOn">Mouse Lock</label>
    </div>

    <!-- <button onclick={enterPointerlock}>Enter Pointer Lock</button> -->
    <div style="padding-top: 10px; display: flex; gap: 20px;">
      <div>
        <!-- <textarea onkeydown={onKeyDown} onkeyup={onKeyUp}></textarea> -->
        <button onclick={() => (showExtraButtons = !showExtraButtons)}
          >Show/hide extra buttons</button
        >
        {#if showExtraButtons}
          <div id="button_div" style="display: block; flex-grow:1;">
            {#each readyKeycodes as keycode}
              <button
                onclick={() => {
                  console.log(keycode);
                  sendKeycode(keycode[1]);
                }}>{keycode[0]}</button
              >
            {/each}
          </div>
        {/if}
      </div>
    </div>
    <div class="term-log">
      <div id="output" class="text-sm font-mono">
        {#each output.split("\n") as line}
          <div>{line}</div>
        {/each}
      </div>
    </div>
  </div>
</main>

<style>
  main {
    @apply h-screen w-screen flex justify-center items-center;
  }
  pre {
    text-align: left;
  }
  .term-log {
    /* &::-webkit-scrollbar {
      display: none;
    } */
    @apply overflow-y-scroll;
    position: absolute;
    bottom: 30px;
    left: 30px;
    width: 100%;
    height: 100%;
    max-width: 500px;
    max-height: 200px;
    border: 1px solid black;
    background: oklch(1 0 100 / 0.6);
  }
</style>
