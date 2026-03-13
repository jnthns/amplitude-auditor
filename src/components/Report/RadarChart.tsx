import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
  ResponsiveContainer,
} from 'recharts'
import type { AreaScore } from '../../types/audit'

interface RadarChartProps {
  areaScores: AreaScore[]
}

function RadarChart({ areaScores }: RadarChartProps) {
  const data = areaScores.map((area) => ({
    area: area.area,
    score: area.percentage,
  }))

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="area" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} />
          <Radar dataKey="score" stroke="#467fef" fill="#609fff" fillOpacity={0.35} />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default RadarChart
