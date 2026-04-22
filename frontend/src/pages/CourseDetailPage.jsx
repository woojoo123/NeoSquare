import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getMentorCourseDetail } from '../api/mentorCourses';
import {
  createMentorCourseApplication,
  getMyMentorCourseApplications,
} from '../api/mentorCourseApplications';
import AppLayout from '../components/AppLayout';
import { getCourseSessionEntryState } from '../lib/courseSessionEntryState';
import { useAuthStore } from '../store/authStore';

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

function formatDateTime(value) {
  if (!value) {
    return '일정 미정';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString('ko-KR');
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
    scheduleItems: Array.isArray(course.scheduleItems)
      ? course.scheduleItems.map((item, index) => ({
          id: item.id ?? `schedule-item-${index}`,
          sequence: item.sequence ?? index + 1,
          title: item.title || `회차 ${index + 1}`,
          description: item.description || '',
          startsAt: item.startsAt || null,
          endsAt: item.endsAt || null,
          approvedApplicationCount: Number(item.approvedApplicationCount ?? 0) || 0,
          approvedApplicantNicknames: Array.isArray(item.approvedApplicantNicknames)
            ? item.approvedApplicantNicknames
            : [],
        }))
      : [],
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

function normalizeCourseApplication(rawValue) {
  if (!rawValue) {
    return null;
  }

  return {
    id: rawValue.id ?? null,
    courseId: rawValue.courseId ?? null,
    status: rawValue.status || 'PENDING',
    mentorNickname: rawValue.mentorNickname || '멘토',
    message: rawValue.message || '',
    reviewNote: rawValue.reviewNote || '',
    preferredScheduleTitle: rawValue.preferredScheduleTitle || '',
    preferredScheduleStartsAt: rawValue.preferredScheduleStartsAt || null,
    preferredScheduleEndsAt: rawValue.preferredScheduleEndsAt || null,
    assignedScheduleTitle: rawValue.assignedScheduleTitle || '',
    assignedScheduleStartsAt: rawValue.assignedScheduleStartsAt || null,
    assignedScheduleEndsAt: rawValue.assignedScheduleEndsAt || null,
    assignedScheduleItemId: rawValue.assignedScheduleItemId ?? null,
    sessionEntryOpenAt: rawValue.sessionEntryOpenAt || null,
    sessionEntryCloseAt: rawValue.sessionEntryCloseAt || null,
    reviewedAt: rawValue.reviewedAt || null,
  };
}

function getCourseApplicationStatusCopy(application, sessionEntryState) {
  if (!application) {
    return {
      headline: '아직 신청하지 않았습니다',
      detail: '회차를 선택하고 신청 메시지를 남기면 멘토가 검토합니다.',
    };
  }

  if (application.status === 'PENDING') {
    return {
      headline: '신청 검토 중',
      detail: '멘토가 신청 내용을 확인하는 중입니다.',
    };
  }

  if (application.status === 'REJECTED') {
    return {
      headline: '신청이 반려되었습니다',
      detail: application.reviewNote || '다른 수업을 신청하거나 내용을 보완해 다시 신청할 수 있습니다.',
    };
  }

  if (application.status === 'CANCELED') {
    return {
      headline: '신청이 취소되었습니다',
      detail: '필요하면 다시 신청할 수 있습니다.',
    };
  }

  if (!application.assignedScheduleItemId) {
    return {
      headline: '승인되었지만 회차가 확정되지 않았습니다',
      detail: '멘토가 회차를 배정하면 세션 입장 시간이 표시됩니다.',
    };
  }

  if (sessionEntryState?.status === 'ready') {
    return {
      headline: '지금 수업 세션에 입장할 수 있습니다',
      detail: '배정된 회차 참가자만 세션에 입장할 수 있습니다.',
    };
  }

  if (sessionEntryState?.status === 'upcoming') {
    return {
      headline: '입장 가능 시간 전입니다',
      detail: '수업 시작 10분 전부터 세션 입장이 열립니다.',
    };
  }

  if (sessionEntryState?.status === 'expired') {
    return {
      headline: '수업 세션 입장 시간이 종료되었습니다',
      detail: '배정된 회차의 세션 입장 시간이 이미 지났습니다.',
    };
  }

  return {
    headline: '수업이 승인되었습니다',
    detail: '배정된 회차 시간과 세션 입장 가능 시간을 확인해 주세요.',
  };
}

export default function CourseDetailPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [course, setCourse] = useState(null);
  const [myCourseApplication, setMyCourseApplication] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedScheduleItemId, setSelectedScheduleItemId] = useState('');
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
        const [courseResponse, myApplicationsResponse] = await Promise.all([
          getMentorCourseDetail(courseId),
          accessToken ? getMyMentorCourseApplications() : Promise.resolve([]),
        ]);

        if (!isMounted) {
          return;
        }

        const normalizedCourse = normalizeCourseDetail(courseResponse);
        const matchingApplication = Array.isArray(myApplicationsResponse)
          ? myApplicationsResponse.find(
              (application) => String(application.courseId) === String(normalizedCourse?.id)
            )
          : null;
        setCourse(normalizedCourse);
        setMyCourseApplication(normalizeCourseApplication(matchingApplication));
        setSelectedScheduleItemId(
          normalizedCourse?.scheduleItems?.[0]?.id ? String(normalizedCourse.scheduleItems[0].id) : ''
        );
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
  }, [accessToken, courseId]);

  const isCourseFull = useMemo(
    () => Boolean(course) && course.remainingCapacity <= 0,
    [course]
  );
  const selectedScheduleItem = useMemo(
    () =>
      course?.scheduleItems?.find((item) => String(item.id) === String(selectedScheduleItemId)) ||
      course?.scheduleItems?.[0] ||
      null,
    [course?.scheduleItems, selectedScheduleItemId]
  );
  const courseSessionEntryState = useMemo(
    () => getCourseSessionEntryState(myCourseApplication),
    [myCourseApplication]
  );
  const courseApplicationStatusCopy = useMemo(
    () => getCourseApplicationStatusCopy(myCourseApplication, courseSessionEntryState),
    [courseSessionEntryState, myCourseApplication]
  );
  const canEnterCourseSession = useMemo(
    () =>
      Boolean(
        myCourseApplication?.status === 'APPROVED' &&
          myCourseApplication?.assignedScheduleItemId &&
          courseSessionEntryState?.canEnter
      ),
    [courseSessionEntryState?.canEnter, myCourseApplication?.assignedScheduleItemId, myCourseApplication?.status]
  );

  async function handleApplicationSubmit(event) {
    event.preventDefault();

    if (!accessToken) {
      navigate('/login', {
        state: {
          message: '로그인 후 멘토링 신청을 이어갈 수 있습니다.',
        },
      });
      return;
    }

    if (!course?.id || isCourseFull) {
      return;
    }

    setApplicationStatus('saving');
    setApplicationNotice('');
    setApplicationError('');

    try {
      await createMentorCourseApplication(course.id, {
        preferredScheduleItemId: selectedScheduleItemId ? Number(selectedScheduleItemId) : null,
        message: applicationMessage.trim(),
      });

      const refreshedApplications = await getMyMentorCourseApplications();
      const refreshedApplication = Array.isArray(refreshedApplications)
        ? refreshedApplications.find(
            (application) => String(application.courseId) === String(course.id)
          )
        : null;
      setMyCourseApplication(normalizeCourseApplication(refreshedApplication));
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
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate(accessToken ? '/hub' : '/courses')}
          >
            {accessToken ? '허브로 돌아가기' : '목록으로 돌아가기'}
          </button>
          {course?.mentorId ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate('/mentors', { state: { mentorId: course.mentorId } })}
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
                <span className="course-detail-card__eyebrow">Schedule</span>
                <h3>수업 일정</h3>
                {course.scheduleItems.length ? (
                  <div className="course-curriculum-list">
                    {course.scheduleItems.map((item) => (
                      <article key={item.id} className="course-curriculum-item">
                        <strong>
                          {item.sequence}회차 · {item.title}
                        </strong>
                        <p>{formatDateTime(item.startsAt)} - {formatDateTime(item.endsAt)}</p>
                        <p>배정 인원: {item.approvedApplicationCount || 0}명</p>
                        {item.approvedApplicantNicknames?.length ? (
                          <p>참여자: {item.approvedApplicantNicknames.join(', ')}</p>
                        ) : null}
                        <p>{item.description || '회차 설명이 없습니다.'}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p>아직 등록된 수업 일정이 없습니다.</p>
                )}
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
                <p>{courseApplicationStatusCopy.headline}</p>
                <p>{courseApplicationStatusCopy.detail}</p>
                {myCourseApplication?.assignedScheduleTitle ? (
                  <p>
                    확정 회차: {myCourseApplication.assignedScheduleTitle} ·{' '}
                    {formatDateTime(myCourseApplication.assignedScheduleStartsAt)}
                  </p>
                ) : null}
                {myCourseApplication?.status === 'APPROVED' &&
                courseSessionEntryState?.entryOpenAt &&
                courseSessionEntryState?.entryCloseAt ? (
                  <p>
                    세션 입장 가능 시간: {formatDateTime(courseSessionEntryState.entryOpenAt)} ~{' '}
                    {formatDateTime(courseSessionEntryState.entryCloseAt)}
                  </p>
                ) : null}
                {canEnterCourseSession ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                      navigate(`/mentoring/session/${myCourseApplication.id}?type=course_application`, {
                        state: { courseApplication: myCourseApplication },
                      })
                    }
                  >
                    내 수업 세션 입장
                  </button>
                ) : null}
                {!accessToken ? (
                  <p>비로그인 상태에서는 내용을 둘러볼 수 있고, 신청은 로그인 후 이어서 진행할 수 있습니다.</p>
                ) : null}
                <form className="mentoring-form" onSubmit={handleApplicationSubmit}>
                  {course.scheduleItems.length ? (
                    <>
                      <label className="app-field">
                        <span>희망 회차</span>
                        <select
                          className="app-input"
                          value={selectedScheduleItemId}
                          onChange={(event) => setSelectedScheduleItemId(event.target.value)}
                          disabled={
                            applicationStatus === 'saving' ||
                            isCourseFull ||
                            myCourseApplication?.status === 'PENDING' ||
                            myCourseApplication?.status === 'APPROVED'
                          }
                        >
                          {course.scheduleItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.sequence}회차 · {item.title} · {formatDateTime(item.startsAt)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {selectedScheduleItem ? (
                        <p>
                          선택한 회차: {selectedScheduleItem.sequence}회차 {selectedScheduleItem.title}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                  <label className="app-field">
                    <span>신청 메시지</span>
                    <textarea
                      className="app-input mentoring-textarea"
                      value={applicationMessage}
                      onChange={(event) => setApplicationMessage(event.target.value)}
                      rows={4}
                      placeholder="이 수업에서 어떤 도움을 받고 싶은지 적어 주세요."
                      disabled={
                        applicationStatus === 'saving' ||
                        isCourseFull ||
                        myCourseApplication?.status === 'PENDING' ||
                        myCourseApplication?.status === 'APPROVED'
                      }
                    />
                  </label>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={
                      applicationStatus === 'saving' ||
                      isCourseFull ||
                      myCourseApplication?.status === 'PENDING' ||
                      myCourseApplication?.status === 'APPROVED'
                    }
                  >
                    {applicationStatus === 'saving'
                      ? '신청 중...'
                      : isCourseFull
                        ? '잔여 좌석 없음'
                        : myCourseApplication?.status === 'PENDING'
                          ? '검토 중'
                          : myCourseApplication?.status === 'APPROVED'
                            ? '신청 완료'
                        : accessToken
                          ? '멘토링 신청'
                          : '로그인 후 신청'}
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
