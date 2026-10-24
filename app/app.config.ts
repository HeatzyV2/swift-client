export default defineAppConfig({
  ui: {
    // Nuxt UI's built-in icons (checkmarks, chevrons, spinners…): Lucide, like the rest of the launcher
    icons: {
      arrowLeft: 'i-lucide-arrow-left',
      arrowRight: 'i-lucide-arrow-right',
      check: 'i-lucide-check',
      chevronDoubleLeft: 'i-lucide-chevrons-left',
      chevronDoubleRight: 'i-lucide-chevrons-right',
      chevronDown: 'i-lucide-chevron-down',
      chevronLeft: 'i-lucide-chevron-left',
      chevronRight: 'i-lucide-chevron-right',
      chevronUp: 'i-lucide-chevron-up',
      close: 'i-lucide-x',
      ellipsis: 'i-lucide-ellipsis',
      external: 'i-lucide-external-link',
      info: 'i-lucide-info',
      loading: 'i-lucide-loader-circle',
      minus: 'i-lucide-minus',
      plus: 'i-lucide-plus',
      search: 'i-lucide-search',
      success: 'i-lucide-circle-check',
      warning: 'i-lucide-triangle-alert',
      error: 'i-lucide-octagon-alert',
    },

    colors: {
      primary: 'swift',
      neutral: 'neutral',
    },

    button: {
      slots: {
        base: 'rounded-[10px] font-semibold transition-[transform,background-color,box-shadow,filter] duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.98]',
      },
      compoundVariants: [
        {
          color: 'primary',
          variant: 'solid',
          class: 'sw-on-accent bg-primary hover:bg-[var(--sw-accent-hover)] active:bg-primary disabled:bg-primary aria-disabled:bg-primary shadow-[0_6px_20px_-6px_color-mix(in_srgb,var(--sw-accent)_70%,transparent)]',
        },
        {
          variant: ['outline', 'subtle'],
          class: 'ring-1 ring-[var(--sw-line-strong)] hover:ring-[color-mix(in_srgb,var(--sw-accent)_45%,var(--sw-line-strong))]',
        },
      ],
    },

    card: {
      slots: {
        root: 'rounded-[16px] overflow-hidden',
        header: 'p-4 sm:px-5',
        title: 'text-highlighted font-semibold',
        description: 'mt-1 text-muted text-sm',
        body: 'p-4 sm:p-5',
        footer: 'p-4 sm:px-5',
      },
      variants: {
        variant: {
          outline: { root: 'bg-muted ring-1 ring-[var(--sw-line)] shadow-sm divide-y divide-default' },
          soft: { root: 'bg-muted divide-y divide-default' },
          subtle: { root: 'bg-muted ring-1 ring-[var(--sw-line)] divide-y divide-default' },
        },
      },
      defaultVariants: {
        variant: 'outline',
      },
    },

    modal: {
      slots: {
        content: 'bg-elevated divide-y divide-default flex flex-col focus:outline-none ring-1 ring-[var(--sw-line-strong)] shadow-2xl rounded-[18px]',
        title: 'text-highlighted font-display text-lg',
      },
      variants: {
        overlay: {
          true: { overlay: 'bg-black/60 backdrop-blur-sm' },
        },
      },
    },

    input: {
      slots: {
        base: 'rounded-[10px] transition-[box-shadow,background-color] duration-150 ring-1 ring-[var(--sw-line-strong)] focus-visible:ring-2 focus-visible:ring-[var(--sw-accent)]',
      },
    },

    textarea: {
      slots: {
        base: 'rounded-[10px] ring-1 ring-[var(--sw-line-strong)] focus-visible:ring-2 focus-visible:ring-[var(--sw-accent)]',
      },
    },

    select: {
      slots: {
        base: 'rounded-[10px] ring-1 ring-[var(--sw-line-strong)] focus-visible:ring-2 focus-visible:ring-[var(--sw-accent)]',
        content: 'ring-1 ring-[var(--sw-line-strong)] shadow-xl rounded-[12px]',
      },
    },

    selectMenu: {
      slots: {
        base: 'rounded-[10px] ring-1 ring-[var(--sw-line-strong)] focus-visible:ring-2 focus-visible:ring-[var(--sw-accent)]',
        content: 'ring-1 ring-[var(--sw-line-strong)] shadow-xl rounded-[12px]',
      },
    },

    dropdownMenu: {
      slots: {
        content: 'ring-1 ring-[var(--sw-line-strong)] shadow-xl rounded-[12px]',
      },
    },

    contextMenu: {
      slots: {
        content: 'ring-1 ring-[var(--sw-line-strong)] shadow-xl rounded-[12px]',
      },
    },

    popover: {
      slots: {
        content: 'ring-1 ring-[var(--sw-line-strong)] shadow-xl rounded-[14px]',
      },
    },

    toast: {
      slots: {
        root: 'ring-1 ring-[var(--sw-line-strong)] shadow-xl rounded-[14px]',
        title: 'font-semibold',
      },
    },

    alert: {
      slots: {
        root: 'rounded-[12px]',
      },
    },

    badge: {
      slots: {
        base: 'rounded-[6px] font-semibold',
      },
    },

    tabs: {
      slots: {
        trigger: 'font-semibold',
        indicator: 'rounded-[8px]',
      },
    },

    progress: {
      slots: {
        base: 'rounded-full',
        indicator: 'rounded-full',
      },
    },

    tooltip: {
      slots: {
        content: 'bg-elevated ring-1 ring-[var(--sw-line-strong)] shadow-lg rounded-[8px] text-highlighted',
      },
    },
  },
})
