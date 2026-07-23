import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { TriangleAlert } from 'lucide-react'
import { issueMessage, type CheckoutIssue } from '../types'

export function CheckoutIssues({ issues }: { issues: CheckoutIssue[] }) {
  if (issues.length === 0) return null

  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertDescription>
        <ul className="list-inside list-disc">
          {issues.map((issue, i) => (
            <li key={i}>{issueMessage(issue)}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
