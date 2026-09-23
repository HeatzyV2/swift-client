export default defineAppConfig({
  ui: {
    colors: {
      primary: 'swift',
      neutral: 'neutral',
    },

    button: {
      slots: {
        base: 'font-medium transition-colors duration-150',
      },
      compoundVariants: [
        {
          color: 'primary',
          variant: 'solid',
          class: 'text-white bg-primary hover:bg-[var(--sw-accent-hover)] active:bg-primary disabled:bg-primary aria-disabled:bg-primary',
        },
      ],
    },

    card: {
      slots: {
        root: 'rounded-[10px] overflow-hidden',
        header: 'p-4 sm:px-5',
        title: 'text-highlighted font-semibold',
        description: 'mt-1 text-muted text-sm',
        body: 'p-4 sm:p-5',
        footer: 'p-4 sm:px-5',
      },
      variants: {
        variant: {
          outline: { root: 'bg-muted ring ring-default divide-y divide-default' },
          soft: { root: 'bg-muted divide-y divide-default' },
          subtle: { root: 'bg-muted ring ring-default divide-y divide-default' },
        },
      },
      defaultVariants: {
        variant: 'outline',
      },
    },

    modal: {
      slots: {
        content: 'bg-elevated divide-y divide-default flex flex-col focus:outline-none',
        title: 'text-highlighted font-semibold font-display text-base',
      },
      variants: {
        overlay: {
          true: { overlay: 'bg-black/70' },
        },
      },
    },

    input: {
      slots: {
        base: 'transition-colors duration-150',
      },
    },

    tooltip: {
      slots: {
        content: 'bg-elevated ring ring-default text-highlighted',
      },
    },
  },
})
