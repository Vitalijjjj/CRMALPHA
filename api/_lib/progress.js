const prisma = require('./db')

/**
 * Recalculates project progress as COUNT(DONE tasks) / COUNT(all tasks) * 100
 * and persists it to projects.progress.
 */
async function recalculateProgress(projectId) {
  const [total, done] = await Promise.all([
    prisma.task.count({ where: { project_id: projectId } }),
    prisma.task.count({ where: { project_id: projectId, status: 'DONE' } }),
  ])

  const progress = total === 0 ? 0 : Math.round((done / total) * 100)

  await prisma.project.update({
    where: { id: projectId },
    data: { progress },
  })

  return progress
}

module.exports = { recalculateProgress }
