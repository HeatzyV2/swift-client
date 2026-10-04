export default defineAppConfig({
  ui: {
    // Nuxt UI's built-in icons (checkmarks, chevrons, spinners…) in pixel style too
    icons: {
      arrowLeft: 'i-pixelarticons-arrow-left',
      arrowRight: 'i-pixelarticons-arrow-right',
      check: 'i-pixelarticons-check',
      chevronDoubleLeft: 'i-pixelarticons-chevrons-horizontal',
      chevronDoubleRight: 'i-pixelarticons-chevrons-horizontal',
      chevronDown: 'i-pixelarticons-chevron-down',
      chevronLeft: 'i-pixelarticons-chevron-left',
      chevronRight: 'i-pixelarticons-chevron-right',
      chevronUp: 'i-pixelarticons-chevron-up',
      close: 'i-pixelarticons-close',
      ellipsis: 'i-pixelarticons-more-horizontal',
      external: 'i-pixelarticons-external-link',
      info: 'i-pixelarticons-info-box',
      loading: 'i-pixelarticons-loader',
      minus: 'i-pixelarticons-minus',
      plus: 'i-pixelarticons-plus',
      search: 'i-pixelarticons-search',
      success: 'i-pixelarticons-checkbox-on',
      warning: 'i-pixelarticons-warning-diamond',
      error: 'i-pixelarticons-alert',
    },

    colors: {
      primary: 'swift',
      neutral: 'neutral',
    },

    button: {
      slots: {
        base: 'rounded-[3px] font-display font-semibold tracking-wide transition-[transform,background-color] duration-75 [transition-timing-function:steps(2)] active:translate-y-[2px]',
      },
      compoundVariants: [
        {
          color: 'primary',
          variant: 'solid',
          class: 'sw-on-accent bg-primary hover:bg-[var(--sw-accent-hover)] active:bg-primary disabled:bg-primary aria-disabled:bg-primary',
        },
        // Raised variants share the chunky bevel + solid side; ghost and link stay flat.
        {
          variant: 'solid',
          class: 'border-2 border-[var(--sw-ink)] shadow-[inset_0_3px_0_rgb(255_255_255/0.25),inset_0_-3px_0_rgb(0_0_0/0.25),0_3px_0_0_var(--sw-ink)] active:shadow-[inset_0_3px_0_rgb(255_255_255/0.25),inset_0_-3px_0_rgb(0_0_0/0.25),0_1px_0_0_var(--sw-ink)]',
        },
        {
          variant: ['outline', 'soft', 'subtle'],
          class: 'ring-0 border-2 border-[var(--sw-line-strong)] shadow-[0_3px_0_0_var(--sw-block-side)] active:shadow-[0_1px_0_0_var(--sw-block-side)]',
        },
      ],
    },

    card: {
      slots: {
        root: 'rounded-[6px] overflow-hidden',
        header: 'p-4 sm:px-5',
        title: 'text-highlighted font-semibold',
        description: 'mt-1 text-muted text-sm',
        body: 'p-4 sm:p-5',
        footer: 'p-4 sm:px-5',
      },
      variants: {
        variant: {
          outline: { root: 'bg-muted ring-0 border-2 border-[var(--sw-line-strong)] shadow-[0_4px_0_0_var(--sw-block-side)] divide-y divide-default' },
          soft: { root: 'bg-muted divide-y divide-default' },
          subtle: { root: 'bg-muted ring-0 border-2 border-[var(--sw-line-strong)] divide-y divide-default' },
        },
      },
      defaultVariants: {
        variant: 'outline',
      },
    },

    modal: {
      slots: {
        content: 'bg-elevated divide-y divide-default flex flex-col focus:outline-none ring-0 border-[3px] border-[var(--sw-ink)] shadow-[0_0_0_2px_var(--sw-line-strong),0_8px_0_2px_var(--sw-block-side)] rounded-[6px]',
        title: 'text-highlighted font-semibold font-display text-lg',
      },
      variants: {
        overlay: {
          true: { overlay: 'bg-black/70' },
        },
      },
    },

    input: {
      slots: {
        base: 'rounded-[3px] transition-colors duration-75 ring-0 border-2 border-[var(--sw-line-strong)] focus-visible:ring-0 focus-visible:border-[var(--sw-accent)]',
      },
    },

    textarea: {
      slots: {
        base: 'rounded-[3px] ring-0 border-2 border-[var(--sw-line-strong)] focus-visible:ring-0 focus-visible:border-[var(--sw-accent)]',
      },
    },

    select: {
      slots: {
        base: 'rounded-[3px] ring-0 border-2 border-[var(--sw-line-strong)] focus-visible:ring-0 focus-visible:border-[var(--sw-accent)]',
        content: 'ring-0 border-2 border-[var(--sw-ink)] shadow-[0_4px_0_0_var(--sw-block-side)] rounded-[4px]',
      },
    },

    selectMenu: {
      slots: {
        base: 'rounded-[3px] ring-0 border-2 border-[var(--sw-line-strong)] focus-visible:ring-0 focus-visible:border-[var(--sw-accent)]',
        content: 'ring-0 border-2 border-[var(--sw-ink)] shadow-[0_4px_0_0_var(--sw-block-side)] rounded-[4px]',
      },
    },

    dropdownMenu: {
      slots: {
        content: 'ring-0 border-2 border-[var(--sw-ink)] shadow-[0_4px_0_0_var(--sw-block-side)] rounded-[4px]',
      },
    },

    contextMenu: {
      slots: {
        content: 'ring-0 border-2 border-[var(--sw-ink)] shadow-[0_4px_0_0_var(--sw-block-side)] rounded-[4px]',
      },
    },

    popover: {
      slots: {
        content: 'ring-0 border-2 border-[var(--sw-ink)] shadow-[0_5px_0_0_var(--sw-block-side)] rounded-[4px]',
      },
    },

    toast: {
      slots: {
        root: 'ring-0 border-2 border-[var(--sw-ink)] shadow-[0_5px_0_0_var(--sw-block-side)] rounded-[4px]',
        title: 'font-display font-semibold',
      },
    },

    alert: {
      slots: {
        root: 'rounded-[4px] ring-0 border-2',
      },
    },

    badge: {
      slots: {
        base: 'rounded-[2px] font-display tracking-wide',
      },
    },

    tabs: {
      slots: {
        trigger: 'font-display tracking-wide [transition-timing-function:steps(2)]',
        indicator: 'rounded-[2px]',
      },
    },

    progress: {
      slots: {
        base: 'rounded-none border-2 border-[var(--sw-ink)]',
        indicator: 'rounded-none [transition-timing-function:steps(8)]',
      },
    },

    switch: {
      slots: {
        base: 'rounded-[2px] border-2 border-[var(--sw-ink)]',
        thumb: 'rounded-[1px]',
      },
    },

    checkbox: {
      slots: {
        base: 'rounded-[2px] border-2',
      },
    },

    tooltip: {
      slots: {
        content: 'bg-elevated ring-0 border-2 border-[var(--sw-ink)] shadow-[0_3px_0_0_var(--sw-block-side)] rounded-[3px] font-display text-highlighted',
      },
    },
  },
})
