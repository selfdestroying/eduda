import { source } from '@/src/lib/docs/source'
import { DocsLayout } from 'fumadocs-ui/layouts/notebook'
import { Binary, Home, User } from 'lucide-react'
import { protocol, rootDomain } from '@/src/lib/utils'

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...{
        nav: {
          title: 'ЕДУДА',
          url: `${protocol}://${rootDomain}`,
        },
        githubUrl: 'https://github.com/selfdestroying/eduda',
        links: [
          {
            type: 'icon',
            icon: <Home />,
            text: 'На главную',
            url: `${protocol}://${rootDomain}`,
            // secondary items will be displayed differently on navbar
            secondary: false,
            external: false,
          },
        ],
      }}
      sidebar={{
        collapsible: false,
      }}
      tabs={[
        {
          title: 'Для пользователей',
          url: '/user',
          icon: <User />,
        },
        {
          title: 'Для разработчиков',
          url: '/dev',
          icon: <Binary />,
        },
      ]}
    >
      {children}
    </DocsLayout>
  )
}
