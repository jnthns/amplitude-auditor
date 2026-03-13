interface FileUploadProps {
  label: string
  required?: boolean
  file: File | null
  onChange: (file: File | null) => void
  helperText?: string
}

function FileUpload({ label, required = false, file, onChange, helperText }: FileUploadProps) {
  return (
    <div>
      <label className="input-label">{label}{required ? ' *' : ''}</label>
      <label className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600 hover:bg-slate-100">
        <span>{file?.name ?? 'Choose CSV file'}</span>
        <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-700">Browse</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
      </label>
      {helperText ? <p className="mt-1 text-xs text-slate-500">{helperText}</p> : null}
    </div>
  )
}

export default FileUpload
