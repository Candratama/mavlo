<script lang="ts" module>
	export type LimelightNavItem = {
		id: string | number;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		icon: any;
		label?: string;
		href?: string;
		onClick?: () => void;
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { onMount, tick } from 'svelte';

	type Props = {
		items: LimelightNavItem[];
		activeIndex?: number;
		onTabChange?: (index: number) => void;
		class?: string;
		limelightClass?: string;
		iconContainerClass?: string;
		iconClass?: string;
	};

	let {
		items,
		activeIndex = $bindable(0),
		onTabChange,
		class: className = '',
		limelightClass = '',
		iconContainerClass = '',
		iconClass = ''
	}: Props = $props();

	const itemRefs: HTMLAnchorElement[] = $state([]);
	let limelightEl: HTMLDivElement | undefined = $state();
	let isReady = $state(false);
	let leftPx = $state(-999);

	async function reposition() {
		await tick();
		const active = itemRefs[activeIndex];
		const lime = limelightEl;
		if (!active || !lime) return;
		leftPx = active.offsetLeft + active.offsetWidth / 2 - lime.offsetWidth / 2;
		if (!isReady) {
			setTimeout(() => (isReady = true), 50);
		}
	}

	$effect(() => {
		void activeIndex;
		void items.length;
		reposition();
	});

	onMount(() => {
		const onResize = () => reposition();
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	function handleClick(e: MouseEvent, idx: number, item: LimelightNavItem) {
		activeIndex = idx;
		onTabChange?.(idx);
		item.onClick?.();
		if (!item.href) e.preventDefault();
	}
</script>

<nav
	class={cn(
		'bg-card text-foreground relative inline-flex h-16 items-center rounded-full border px-2',
		className
	)}
>
	{#each items as item, index (item.id)}
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			bind:this={itemRefs[index]}
			href={item.href ?? '#'}
			onclick={(e) => handleClick(e, index, item)}
			aria-label={item.label}
			class={cn(
				'relative z-20 flex h-full cursor-pointer items-center justify-center p-5',
				iconContainerClass
			)}
		>
			<item.icon
				class={cn(
					'h-6 w-6 transition-opacity duration-100 ease-in-out',
					activeIndex === index ? 'opacity-100' : 'opacity-40',
					iconClass
				)}
			/>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/each}

	<div
		bind:this={limelightEl}
		class={cn(
			'bg-primary absolute top-0 z-10 h-[5px] w-11 rounded-full',
			isReady ? 'transition-[left] duration-400 ease-in-out' : '',
			activeIndex < 0 ? 'opacity-0' : '',
			limelightClass
		)}
		style="left: {leftPx}px; box-shadow: 0 50px 15px var(--primary);"
	>
		<div
			class="from-primary/30 pointer-events-none absolute top-[5px] left-[-30%] h-14 w-[160%] bg-gradient-to-b to-transparent [clip-path:polygon(5%_100%,25%_0,75%_0,95%_100%)]"
		></div>
	</div>
</nav>
