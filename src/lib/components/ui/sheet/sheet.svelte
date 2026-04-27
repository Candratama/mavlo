<script lang="ts">
	import { Dialog as SheetPrimitive } from "bits-ui";
	import { useModalBackClose } from "$lib/utils/modal-history.js";

	let { open = $bindable(false), ...restProps }: SheetPrimitive.RootProps = $props();

	$effect(() => useModalBackClose(open, () => (open = false)));
</script>

<SheetPrimitive.Root bind:open {...restProps} />
