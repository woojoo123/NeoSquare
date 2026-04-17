import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getMentorCourseDetail } from '../api/mentorCourses';
import { createMentorCourseApplication } from '../api/mentorCourseApplications';
import AppLayout from '../components/AppLayout';

function formatCurrency(value) {
  const numericValue = Number(value) || 0;
  return numericValue === 0 ? '무료' : `${numericValue.toLocaleString()}원`;
}

function formatMeetingTypeLabel(meetingType) {
  if (meetingType === 'ONLINE') {
    return '온라인';
  }

  if (meetingType === 'OFFLINE') {
    return '오프라인';
  }

  if (meetingType === 'HYBRID') {
    return '온오프라인';
  }

  return meetingType || '미정';
}

function normalizeCourseDetail(rawValue) {
  if (!rawValue) {
    return null;
  }

  const course = rawValue.item || rawValue.course || rawValue;

  return {
    id: course.id ?? null,
    title: course.title || '수업',
    summary: course.summary || '',
    description: course.description || '',
    meetingType: course.meetingType || 'ONLINE',
    price: Number(course.price ?? 0) || 0,
    capacity: Number(course.capacity ?? 0) || 0,
    approvedApplicationCount: Number(course.approvedApplicationCount ?? 0) || 0,
    remainingCapacity: Number(course.remainingCapacity ?? 0) || 0,
    mentorId: course.mentorId ?? null,
    mentorNickname: course.mentorNickname || '멘토',
    mentorBio: course.mentorBio || '',
    mentorInterests: course.mentorInterests || '',
    mentorSpecialties: course.mentorSpecialties || '',
    mentorAvatarUrl: course.mentorAvatarUrl || '',
    curriculumItems: Array.isArray(course.curriculumItems)
      ? course.curriculumItems.map((item, index) => ({
          id: item.id ?? `curriculum-item-${index}`,
          sequence: item.sequence ?? index + 1,
          title: item.title || `단계 ${index + 1}`,
          description: item.description || '',
        }))
      : [],
  };
}

export default function CourseDetailPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [applicationMessage, setApplicationMessage] = useState('');
  const [applicationNotice, setApplicationNotice] = useState('');
  const [applicationError, setApplicationError] = useState('');
  const [applicationStatus, setApplicationStatus] = useState('idle');

  useEffect(() => {
    let isMounted = true;

    async function loadCourseDetail() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await getMentorCourseDetail(courseId);

        if (!isMounted) {
          return;
        }

        setCourse(normalizeCourseDetail(response));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error?.response?.data?.message || error.message || '수업 상세를 불러오지 못했습니다.'
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCourseDetail();

    return () => {
      isMounted = false;
    };
  }, [courseId]);

  const isCourseFull = useMemo(
    () => Boolean(course) && course.remainingCapacity <= 0,
    [course]
  );

  async function handleApplicationSubmit(event) {
    event.preventDefault();

    if (!course?.id || isCourseFull) {
      return;
    }

    setApplicationStatus('saving');
    setApplicationNotice('');
    setApplicationError('');

    try {
      await createMentorCourseApplication(course.id, {
        message: applicationMessage.trim(),
      });

      setApplicationStatus('saved');
      setApplicationNotice('수업 신청을 보냈습니다. 허브의 내 진행에서 상태를 확인할 수 있습니다.');
      setApplicationMessage('');
    } catch (error) {
      setApplicationStatus('error');
      setApplicationError(
        error?.response?.data?.message || error.message || '수업 신청에 실패했습니다.'
      );
    }
  }

  return (
    <AppLayout
      eyebrow="수업 상세"
      title={course?.title || '수업을 불러오는 중입니다'}
      description={
        course?.summary || '멘토 수업의 상세 설명과 커리큘럼, 신청 정보를 확인할 수 있습니다.'
      }
      panelClassName="app-panel--wide course-detail-shell"
    >
      <section className="course-detail-page">
        <div className="course-detail-page__actions">
          <button type="button" className="secondary-button" onClick={() => navigate('/hub')}>
            허브로 돌아가기
          </button>
          {course?.mentorId ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate('/hub')}
            >
              멘토 목록으로 이동
            </button>
          ) : null}
        </div>

        {isLoading ? <p>수업 상세를 불러오는 중입니다.</p> : null}
        {errorMessage ? <p className="app-error">{errorMessage}</p> : null}

        {course ? (
          <div className="course-detail-layout">
            <article className="course-detail-hero">
              <div className="course-detail-hero__copy">
                <span className="course-detail-hero__eyebrow">Course Overview</span>
                <h2>{course.title}</h2>
                <p>{course.description || '상세 설명이 없습니다.'}</p>
                <div className="course-detail-meta">
                  <span>{formatMeetingTypeLabel(course.meetingType)}</span>
                  <span>{formatCurrency(course.price)}</span>
                  <span>정원 {course.capacity}명</span>
                  <span>승인 {course.approvedApplicationCount}명</span>
                  <span>잔여 {course.remainingCapacity}석</span>
                </div>
              </div>
            </article>

            <div className="course-detail-grid">
              <section className="course-detail-card">
                <span className="course-detail-card__eyebrow">Mentor</span>
                <h3>{course.mentorNickname}</h3>
                <p>{course.mentorBio || '멘토 소개가 없습니다.'}</p>
                <p>전문 분야: {course.mentorSpecialties || '미등록'}</p>
                <p>관심사: {course.mentorInterests || '미등록'}</p>
              </section>

              <section className="course-detail-card">
                <span className="course-detail-card__eyebrow">Curriculum</span>
                <h3>수업 진행 흐름</h3>
                {course.curriculumItems.length ? (
                  <div className="course-curriculum-list">
                    {course.curriculumItems.map((item) => (
                      <article key={item.id} className="course-curriculum-item">
                        <strong>
                          {item.sequence}. {item.title}
                        </strong>
                        <p>{item.description}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p>아직 등록된 커리큘럼이 없습니다.</p>
                )}
              </section>

              <section className="course-detail-card course-detail-card--wide">
                <span className="course-detail-card__eyebrow">Apply</span>
                <h3>수업 신청</h3>
                {applicationNotice ? <p className="app-success">{applicationNotice}</p> : null}
                {applicationError ? <p className="app-error">{applicationError}</p> : null}
                <form className="mentoring-form" onSubmit={handleApplicationSubmit}>
                  <label className="app-field">
                    <span>신청 메시지</span>
                    <textarea
                      className="app-input mentoring-textarea"
                      value={applicationMessage}
                      onChange={(event) => setApplicationMessage(event.target.value)}
                      rows={4}
                      placeholder="이 수업에서 어떤 도움을 받고 싶은지 적어 주세요."
                      disabled={applicationStatus === 'saving' || isCourseFull}
                    />
                  </label>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={applicationStatus === 'saving' || isCourseFull}
                  >
                    {applicationStatus === 'saving'
                      ? '신청 중...'
                      : isCourseFull
                        ? '잔여 좌석 없음'
                        : '수업 신청'}
                  </button>
                </form>
              </section>
            </div>
          </div>
        ) : null}
      </section>
    </AppLayout>
  );
}
