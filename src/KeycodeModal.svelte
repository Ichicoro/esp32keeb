<script lang="ts">
  import { KEYCODES } from "./keycodes";
  let { sendKeycode, showExtraButtons = $bindable() } = $props();

  const readyKeycodes = $derived(Object.entries(KEYCODES));
</script>

<dialog open class="absolute top-0 left-0 w-screen h-screen bg-black/50">
  <div class="w-screen h-screen flex flex-row justify-center items-center p-4">
    <div
      class="max-h-[50vh] max-w-3xl w-full rounded-2xl flex flex-col overflow-clip bg-[var(--background-color)]"
    >
      <div
        class="flex justify-between items-center relative p-2 border-bottom border-b-2 border-black/10"
      >
        <h2 class="ms-2.5 font-bold">Extra buttons</h2>
        <button
          onclick={() => {
            showExtraButtons = false;
          }}
        >
          Close
        </button>
      </div>
      <div class="w-full relative p-2 h-full overflow-y-scroll">
        <div class="grid grid-cols-6 gap-2">
          {#each readyKeycodes as [code, keycode]}
            <button
              class="btn-dialog text-sm overflow-hidden py-0 flex justify-center items-center"
              onmousedown={() => sendKeycode(keycode, "press")}
              onmouseup={() => sendKeycode(keycode, "release")}
            >
              {code}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>
</dialog>
