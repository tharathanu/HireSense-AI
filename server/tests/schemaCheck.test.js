const { checkArgs } = require('./helpers/prismaMock');
// The schema checker itself must catch wrong fields, relations and enum values
test('schema checker catches query mistakes', () => {
  expect(() => checkArgs('Application', { where: { candidat: 'x' } })).toThrow(/no field "candidat"/);
  expect(() => checkArgs('Job', { include: { title: true } })).toThrow(/not a relation/);
  expect(() => checkArgs('Application', { data: { status: 'PASSED' } })).toThrow(/not a valid ApplicationStatus/);
  expect(() => checkArgs('Job', { where: { skills: { some: { skil: { name: 'x' } } } } })).toThrow(/JobSkill has no field "skil"/);
  expect(() => checkArgs('Job', { where: { title: { containz: 'x' } } })).toThrow(/unknown filter/);
  expect(() => checkArgs('Application', { where: { candidateId_jobId: { candidateId: 'a', jobId: 'b' } } })).not.toThrow();
});
