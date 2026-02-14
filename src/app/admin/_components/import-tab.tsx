'use client'

import type { ImportValidationResponse } from '@/src/actions/import'
import { executeCSVImport, validateCSVImport } from '@/src/actions/import'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table'
import { CSV_TABLE_CONFIGS, type CSVTableType } from '@/src/lib/csv-validation'
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react'
import { useCallback, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { AdminDashboardData } from './types'

const TABLE_ORDER: CSVTableType[] = ['courses', 'locations', 'members', 'groups', 'students']

type FileState = {
  file: File
  csvText: string
  tableType: CSVTableType
  validation: ImportValidationResponse | null
  status: 'pending' | 'validating' | 'valid' | 'invalid' | 'importing' | 'imported' | 'error'
}

interface ImportTabProps {
  data: AdminDashboardData
  onRefresh: () => void
}

export default function ImportTab({ data, onRefresh }: ImportTabProps) {
  const [files, setFiles] = useState<FileState[]>([])
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null)
  const [isImporting, startImporting] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback(async (fileState: FileState) => {
    setFiles((prev) =>
      prev.map((f) => (f.file === fileState.file ? { ...f, status: 'validating' as const } : f))
    )

    try {
      const result = await validateCSVImport(fileState.csvText, fileState.tableType)
      setFiles((prev) =>
        prev.map((f) =>
          f.file === fileState.file
            ? {
                ...f,
                validation: result,
                status: result.success ? ('valid' as const) : ('invalid' as const),
              }
            : f
        )
      )
    } catch {
      setFiles((prev) =>
        prev.map((f) => (f.file === fileState.file ? { ...f, status: 'error' as const } : f))
      )
    }
  }, [])

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || [])
      if (!selectedFiles.length) return

      const newFiles: FileState[] = []

      for (const file of selectedFiles) {
        const text = await file.text()

        // Определяем тип таблицы по имени файла
        let detectedType: CSVTableType | null = null
        const lowerName = file.name.toLowerCase()
        if (lowerName.includes('course')) detectedType = 'courses'
        else if (lowerName.includes('location')) detectedType = 'locations'
        else if (lowerName.includes('member')) detectedType = 'members'
        else if (lowerName.includes('group')) detectedType = 'groups'
        else if (lowerName.includes('student')) detectedType = 'students'

        if (detectedType) {
          newFiles.push({
            file,
            csvText: text,
            tableType: detectedType,
            validation: null,
            status: 'pending',
          })
        }
      }

      if (newFiles.length === 0) {
        toast.error('Не удалось определить тип таблицы по имени файла')
        return
      }

      setFiles((prev) => [...prev, ...newFiles])

      // Авто-валидация
      for (const newFile of newFiles) {
        validateFile(newFile)
      }

      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [validateFile]
  )

  const removeFile = useCallback((file: File) => {
    setFiles((prev) => prev.filter((f) => f.file !== file))
  }, [])

  const changeTableType = useCallback(
    (file: File, newType: CSVTableType) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.file === file
            ? { ...f, tableType: newType, validation: null, status: 'pending' as const }
            : f
        )
      )
      const fileState = files.find((f) => f.file === file)
      if (fileState) {
        validateFile({ ...fileState, tableType: newType })
      }
    },
    [files, validateFile]
  )

  const allValid = files.length > 0 && files.every((f) => f.status === 'valid')

  const handleImport = () => {
    if (!selectedOrg) {
      toast.error('Выберите организацию')
      return
    }

    const orgId = parseInt(selectedOrg!)

    // Сортируем файлы в правильном порядке (курсы → локации → члены → группы → ученики)
    const sorted = [...files].sort(
      (a, b) => TABLE_ORDER.indexOf(a.tableType) - TABLE_ORDER.indexOf(b.tableType)
    )

    startImporting(async () => {
      let allSuccess = true

      for (const fileState of sorted) {
        setFiles((prev) =>
          prev.map((f) => (f.file === fileState.file ? { ...f, status: 'importing' as const } : f))
        )

        const result = await executeCSVImport(fileState.csvText, fileState.tableType, orgId)

        if (result.success) {
          setFiles((prev) =>
            prev.map((f) => (f.file === fileState.file ? { ...f, status: 'imported' as const } : f))
          )
          toast.success(`${CSV_TABLE_CONFIGS[fileState.tableType].label}: ${result.message}`)
        } else {
          setFiles((prev) =>
            prev.map((f) => (f.file === fileState.file ? { ...f, status: 'error' as const } : f))
          )
          toast.error(`${CSV_TABLE_CONFIGS[fileState.tableType].label}: ${result.message}`)
          allSuccess = false
          break
        }
      }

      if (allSuccess) {
        toast.success('Все данные успешно импортированы!')
        onRefresh()
      }
    })
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const dt = e.dataTransfer
      if (dt.files.length) {
        const fakeEvent = {
          target: { files: dt.files },
        } as unknown as React.ChangeEvent<HTMLInputElement>
        handleFileSelect(fakeEvent)
      }
    },
    [handleFileSelect]
  )

  return (
    <div className="space-y-6">
      {/* Выбор организации */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Организация для импорта</CardTitle>
          <CardDescription>Выберите организацию, в которую будут загружены данные</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <Select value={selectedOrg} onValueChange={setSelectedOrg}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Выберите организацию" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {data.organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id.toString()}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Зона загрузки */}
      <div
        className="border-muted-foreground/25 hover:border-muted-foreground/50 bg-muted/30 flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <Upload className="text-muted-foreground size-10" />
        <div className="text-center">
          <p className="text-sm font-medium">Перетащите CSV-файлы сюда или нажмите для выбора</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Файлы: courses, locations, members, groups, students
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".csv"
          multiple
          onChange={handleFileSelect}
        />
      </div>

      {/* Загруженные файлы */}
      {files.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Загруженные файлы ({files.length})</h3>

          {files.map((fileState) => (
            <FileCard
              key={fileState.file.name + fileState.file.lastModified}
              fileState={fileState}
              onRemove={removeFile}
              onChangeType={changeTableType}
            />
          ))}

          {/* Кнопка импорта */}
          <div className="flex items-center justify-end gap-3 pt-4">
            {!allValid && files.length > 0 && (
              <p className="text-muted-foreground text-sm">
                Исправьте ошибки валидации чтобы начать импорт
              </p>
            )}
            <Button
              onClick={handleImport}
              disabled={!allValid || !selectedOrg || isImporting}
              size="lg"
            >
              {isImporting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Импорт...
                </>
              ) : (
                <>
                  <FileSpreadsheet />
                  Импортировать всё
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Карточка файла ─────────────────────────────────────────────

function FileCard({
  fileState,
  onRemove,
  onChangeType,
}: {
  fileState: FileState
  onRemove: (file: File) => void
  onChangeType: (file: File, type: CSVTableType) => void
}) {
  const { file, tableType, validation, status } = fileState

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <StatusIcon status={status} />
          <div>
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-muted-foreground text-xs">
              {(file.size / 1024).toFixed(1)} KB
              {validation && ` · ${validation.validation.rowCount} строк`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={tableType} onValueChange={(v) => onChangeType(file, v as CSVTableType)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {TABLE_ORDER.map((type) => (
                  <SelectItem key={type} value={type}>
                    {CSV_TABLE_CONFIGS[type].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <StatusBadge status={status} />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(file)}
            disabled={status === 'importing'}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Ошибки валидации */}
      {validation && !validation.success && (
        <div className="bg-destructive/5 border-t px-4 py-3">
          {validation.headerError && (
            <p className="text-destructive mb-2 text-sm font-medium">{validation.headerError}</p>
          )}
          {validation.validation.errors.length > 0 && (
            <div className="max-h-48 space-y-1 overflow-auto">
              {validation.validation.errors.slice(0, 10).map((err, i) => (
                <p key={i} className="text-destructive text-xs">
                  <span className="font-medium">
                    Строка {err.row}, {err.column}:
                  </span>{' '}
                  {err.message}
                </p>
              ))}
              {validation.validation.errors.length > 10 && (
                <p className="text-muted-foreground text-xs">
                  ...и ещё {validation.validation.errors.length - 10} ошибок
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Превью данных */}
      {validation?.preview && validation.success && (
        <div className="border-t">
          <div className="max-h-52 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {Object.keys(validation.preview[0]).map((header) => (
                    <TableHead key={header} className="text-xs whitespace-nowrap">
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {validation.preview.map((row, i) => (
                  <TableRow key={i}>
                    {Object.values(row).map((val, j) => (
                      <TableCell key={j} className="max-w-48 truncate text-xs whitespace-nowrap">
                        {val || '—'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {validation.validation.rowCount > 5 && (
            <p className="text-muted-foreground px-4 py-2 text-xs">
              Показаны первые 5 из {validation.validation.rowCount} строк
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

function StatusIcon({ status }: { status: FileState['status'] }) {
  switch (status) {
    case 'valid':
    case 'imported':
      return <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
    case 'invalid':
    case 'error':
      return <AlertCircle className="text-destructive size-5 shrink-0" />
    case 'validating':
    case 'importing':
      return <Loader2 className="text-muted-foreground size-5 shrink-0 animate-spin" />
    default:
      return <FileSpreadsheet className="text-muted-foreground size-5 shrink-0" />
  }
}

function StatusBadge({ status }: { status: FileState['status'] }) {
  switch (status) {
    case 'valid':
      return (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-600">
          Валидно
        </Badge>
      )
    case 'invalid':
      return <Badge variant="destructive">Ошибки</Badge>
    case 'validating':
      return <Badge variant="secondary">Проверка...</Badge>
    case 'importing':
      return <Badge variant="secondary">Импорт...</Badge>
    case 'imported':
      return (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-600">
          Импортировано
        </Badge>
      )
    case 'error':
      return <Badge variant="destructive">Ошибка</Badge>
    default:
      return <Badge variant="secondary">Ожидание</Badge>
  }
}
