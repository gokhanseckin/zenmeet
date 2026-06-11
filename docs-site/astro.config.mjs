// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.zenmeet.me',
  integrations: [
    starlight({
      title: 'ZenMeet Docs',
      logo: {
        src: './src/assets/zenmeet-mark.png',
        alt: 'ZenMeet',
        replacesTitle: true, // our SiteTitle override renders mark + wordmark + Docs tag
      },
      customCss: ['./src/styles/custom.css'],
      components: {
        SiteTitle: './src/components/SiteTitle.astro',
        SocialIcons: './src/components/HeaderActions.astro',
      },
      pagination: true,
      lastUpdated: true,
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'What is ZenMeet?', slug: 'what-is-zenmeet' },
            { label: 'Create your account', slug: 'create-your-account' },
          ],
        },
        {
          label: 'For teachers',
          items: [
            { label: 'Set up your classroom page', slug: 'set-up-classroom' },
            { label: 'Schedule live classes', slug: 'schedule-classes' },
            { label: 'Connect Stripe to get paid', slug: 'connect-stripe' },
            { label: 'Manage your members', slug: 'manage-members' },
            { label: 'Payouts & refunds', slug: 'payouts-and-refunds' },
          ],
        },
        {
          label: 'For students',
          items: [
            { label: 'Join a class', slug: 'join-a-class' },
            { label: 'Manage your membership', slug: 'manage-membership' },
          ],
        },
        {
          label: 'Help',
          items: [
            { label: 'FAQ', slug: 'faq' },
            { label: 'Contact support', slug: 'contact-support', badge: { text: '24h', variant: 'note' } },
          ],
        },
      ],
    }),
  ],
});
