<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import { useModalBackClose } from "$lib/utils/modal-history.js";

	let { open = $bindable(false), ...restProps }: DialogPrimitive.RootProps = $props();

	$effect(() => useModalBackClose(open, () => (open = false)));
</script>

<DialogPrimitive.Root bind:open {...restProps} />
